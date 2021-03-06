/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IReference } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ITextModel } from 'vs/editor/common/model';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const ITextModelService = createDecorator<ITextModelService>('textModelService');

export interface ITextModelService {
	readonly _serviceBrand: undefined;

	/**
	 * Provided a resource URI, it will return a model reference
	 * which should be disposed once not needed anymore.
	 */
	createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;
}

export interface ITextEditorModel extends IEditorModel {

	/**
	 * Provides access to the underlying `ITextModel`.
	 */
	readonly textEditorModel: ITextModel | null;
}

export interface IResolvedTextEditorModel extends ITextEditorModel {

	/**
	 * Same as ITextEditorModel#textEditorModel, but never null.
	 */
	readonly textEditorModel: ITextModel;
}
