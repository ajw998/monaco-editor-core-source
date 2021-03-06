/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Emitter } from 'vs/base/common/event';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import * as types from 'vs/base/common/types';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import { IStringDictionary } from 'vs/base/common/collections';

export const Extensions = {
	Configuration: 'base.contributions.configuration'
};

export interface IConfigurationRegistry {

	/**
	 * Register a configuration to the registry.
	 */
	registerConfiguration(configuration: IConfigurationNode): void;

	/**
	 * Returns all configurations settings of all configuration nodes contributed to this registry.
	 */
	getConfigurationProperties(): { [qualifiedKey: string]: IConfigurationPropertySchema };

	/**
	 * Register the identifiers for editor configurations
	 */
	registerOverrideIdentifiers(identifiers: string[]): void;
}

export const enum ConfigurationScope {
	/**
	 * Application specific configuration, which can be configured only in local user settings.
	 */
	APPLICATION = 1,
	/**
	 * Machine specific configuration, which can be configured only in local and remote user settings.
	 */
	MACHINE,
	/**
	 * Window specific configuration, which can be configured in the user or workspace settings.
	 */
	WINDOW,
	/**
	 * Resource specific configuration, which can be configured in the user, workspace or folder settings.
	 */
	RESOURCE,
	/**
	 * Resource specific configuration that can be configured in language specific settings
	 */
	LANGUAGE_OVERRIDABLE,
	/**
	 * Machine specific configuration that can also be configured in workspace or folder settings.
	 */
	MACHINE_OVERRIDABLE,
}

export interface IConfigurationPropertySchema extends IJSONSchema {

	scope?: ConfigurationScope;

	/**
	 * When restricted, value of this configuration will be read only from trusted sources.
	 * For eg., If the workspace is not trusted, then the value of this configuration is not read from workspace settings file.
	 */
	restricted?: boolean;

	included?: boolean;
}

export interface IConfigurationExtensionInfo {
	restrictedConfigurations?: string[];
}

export interface IConfigurationNode {
	id?: string;
	order?: number;
	type?: string | string[];
	title?: string;
	properties?: { [path: string]: IConfigurationPropertySchema; };
	allOf?: IConfigurationNode[];
	scope?: ConfigurationScope;
	extensionInfo?: IConfigurationExtensionInfo;
}

export const allSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const applicationSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const machineSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const machineOverridableSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const windowSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const resourceSettings: { properties: IStringDictionary<IConfigurationPropertySchema>, patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };

export const resourceLanguageSettingsSchemaId = 'vscode://schemas/settings/resourceLanguage';

const contributionRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);

class ConfigurationRegistry implements IConfigurationRegistry {

	private readonly defaultValues: IStringDictionary<any>;
	private readonly defaultLanguageConfigurationOverridesNode: IConfigurationNode;
	private readonly configurationContributors: IConfigurationNode[];
	private readonly configurationProperties: { [qualifiedKey: string]: IJSONSchema };
	private readonly excludedConfigurationProperties: { [qualifiedKey: string]: IJSONSchema };
	private readonly resourceLanguageSettingsSchema: IJSONSchema;
	private readonly overrideIdentifiers = new Set<string>();

	private readonly _onDidSchemaChange = new Emitter<void>();

	private readonly _onDidUpdateConfiguration: Emitter<string[]> = new Emitter<string[]>();

	constructor() {
		this.defaultValues = {};
		this.defaultLanguageConfigurationOverridesNode = {
			id: 'defaultOverrides',
			title: nls.localize('defaultLanguageConfigurationOverrides.title', "Default Language Configuration Overrides"),
			properties: {}
		};
		this.configurationContributors = [this.defaultLanguageConfigurationOverridesNode];
		this.resourceLanguageSettingsSchema = { properties: {}, patternProperties: {}, additionalProperties: false, errorMessage: 'Unknown editor configuration setting', allowTrailingCommas: true, allowComments: true };
		this.configurationProperties = {};
		this.excludedConfigurationProperties = {};

		contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
	}

	public registerConfiguration(configuration: IConfigurationNode, validate: boolean = true): void {
		this.registerConfigurations([configuration], validate);
	}

	public registerConfigurations(configurations: IConfigurationNode[], validate: boolean = true): void {
		const properties: string[] = [];
		configurations.forEach(configuration => {
			properties.push(...this.validateAndRegisterProperties(configuration, validate, configuration.extensionInfo)); // fills in defaults
			this.configurationContributors.push(configuration);
			this.registerJSONConfiguration(configuration);
		});

		contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
		this._onDidSchemaChange.fire();
		this._onDidUpdateConfiguration.fire(properties);
	}

	public registerOverrideIdentifiers(overrideIdentifiers: string[]): void {
		for (const overrideIdentifier of overrideIdentifiers) {
			this.overrideIdentifiers.add(overrideIdentifier);
		}
		this.updateOverridePropertyPatternKey();
	}

	private validateAndRegisterProperties(configuration: IConfigurationNode, validate: boolean = true, extensionInfo?: IConfigurationExtensionInfo, scope: ConfigurationScope = ConfigurationScope.WINDOW): string[] {
		scope = types.isUndefinedOrNull(configuration.scope) ? scope : configuration.scope;
		let propertyKeys: string[] = [];
		let properties = configuration.properties;
		if (properties) {
			for (let key in properties) {
				if (validate && validateProperty(key)) {
					delete properties[key];
					continue;
				}

				const property = properties[key];

				// update default value
				this.updatePropertyDefaultValue(key, property);

				// update scope
				if (OVERRIDE_PROPERTY_PATTERN.test(key)) {
					property.scope = undefined; // No scope for overridable properties `[${identifier}]`
				} else {
					property.scope = types.isUndefinedOrNull(property.scope) ? scope : property.scope;
					property.restricted = types.isUndefinedOrNull(property.restricted) ? !!extensionInfo?.restrictedConfigurations?.includes(key) : property.restricted;
				}

				// Add to properties maps
				// Property is included by default if 'included' is unspecified
				if (properties[key].hasOwnProperty('included') && !properties[key].included) {
					this.excludedConfigurationProperties[key] = properties[key];
					delete properties[key];
					continue;
				} else {
					this.configurationProperties[key] = properties[key];
				}

				if (!properties[key].deprecationMessage && properties[key].markdownDeprecationMessage) {
					// If not set, default deprecationMessage to the markdown source
					properties[key].deprecationMessage = properties[key].markdownDeprecationMessage;
				}

				propertyKeys.push(key);
			}
		}
		let subNodes = configuration.allOf;
		if (subNodes) {
			for (let node of subNodes) {
				propertyKeys.push(...this.validateAndRegisterProperties(node, validate, extensionInfo, scope));
			}
		}
		return propertyKeys;
	}

	getConfigurationProperties(): { [qualifiedKey: string]: IConfigurationPropertySchema } {
		return this.configurationProperties;
	}

	private registerJSONConfiguration(configuration: IConfigurationNode) {
		const register = (configuration: IConfigurationNode) => {
			let properties = configuration.properties;
			if (properties) {
				for (const key in properties) {
					this.updateSchema(key, properties[key]);
				}
			}
			let subNodes = configuration.allOf;
			if (subNodes) {
				subNodes.forEach(register);
			}
		};
		register(configuration);
	}

	private updateSchema(key: string, property: IConfigurationPropertySchema): void {
		allSettings.properties[key] = property;
		switch (property.scope) {
			case ConfigurationScope.APPLICATION:
				applicationSettings.properties[key] = property;
				break;
			case ConfigurationScope.MACHINE:
				machineSettings.properties[key] = property;
				break;
			case ConfigurationScope.MACHINE_OVERRIDABLE:
				machineOverridableSettings.properties[key] = property;
				break;
			case ConfigurationScope.WINDOW:
				windowSettings.properties[key] = property;
				break;
			case ConfigurationScope.RESOURCE:
				resourceSettings.properties[key] = property;
				break;
			case ConfigurationScope.LANGUAGE_OVERRIDABLE:
				resourceSettings.properties[key] = property;
				this.resourceLanguageSettingsSchema.properties![key] = property;
				break;
		}
	}

	private updateOverridePropertyPatternKey(): void {
		for (const overrideIdentifier of this.overrideIdentifiers.values()) {
			const overrideIdentifierProperty = `[${overrideIdentifier}]`;
			const resourceLanguagePropertiesSchema: IJSONSchema = {
				type: 'object',
				description: nls.localize('overrideSettings.defaultDescription', "Configure editor settings to be overridden for a language."),
				errorMessage: nls.localize('overrideSettings.errorMessage', "This setting does not support per-language configuration."),
				$ref: resourceLanguageSettingsSchemaId,
			};
			this.updatePropertyDefaultValue(overrideIdentifierProperty, resourceLanguagePropertiesSchema);
			allSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			applicationSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			machineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			machineOverridableSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			windowSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			resourceSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
		}
		this._onDidSchemaChange.fire();
	}

	private updatePropertyDefaultValue(key: string, property: IConfigurationPropertySchema): void {
		let defaultValue = this.defaultValues[key];
		if (types.isUndefined(defaultValue)) {
			defaultValue = property.default;
		}
		if (types.isUndefined(defaultValue)) {
			defaultValue = getDefaultValue(property.type);
		}
		property.default = defaultValue;
	}
}

const OVERRIDE_PROPERTY = '\\[.*\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

export function overrideIdentifierFromKey(key: string): string {
	return key.substring(1, key.length - 1);
}

export function getDefaultValue(type: string | string[] | undefined): any {
	const t = Array.isArray(type) ? (<string[]>type)[0] : <string>type;
	switch (t) {
		case 'boolean':
			return false;
		case 'integer':
		case 'number':
			return 0;
		case 'string':
			return '';
		case 'array':
			return [];
		case 'object':
			return {};
		default:
			return null;
	}
}


const configurationRegistry = new ConfigurationRegistry();
Registry.add(Extensions.Configuration, configurationRegistry);

export function validateProperty(property: string): string | null {
	if (!property.trim()) {
		return nls.localize('config.property.empty', "Cannot register an empty property");
	}
	if (OVERRIDE_PROPERTY_PATTERN.test(property)) {
		return nls.localize('config.property.languageDefault', "Cannot register '{0}'. This matches property pattern '\\\\[.*\\\\]$' for describing language specific editor settings. Use 'configurationDefaults' contribution.", property);
	}
	if (configurationRegistry.getConfigurationProperties()[property] !== undefined) {
		return nls.localize('config.property.duplicate', "Cannot register '{0}'. This property is already registered.", property);
	}
	return null;
}
