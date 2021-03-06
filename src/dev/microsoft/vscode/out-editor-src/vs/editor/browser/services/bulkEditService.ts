/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { TextEdit, WorkspaceEdit, WorkspaceEditMetadata, WorkspaceFileEdit, WorkspaceFileEditOptions, WorkspaceTextEdit } from 'vs/editor/common/modes';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { isObject } from 'vs/base/common/types';

export const IBulkEditService = createDecorator<IBulkEditService>('IWorkspaceEditService');

function isWorkspaceFileEdit(thing: any): thing is WorkspaceFileEdit {
	return isObject(thing) && (Boolean((<WorkspaceFileEdit>thing).newUri) || Boolean((<WorkspaceFileEdit>thing).oldUri));
}

function isWorkspaceTextEdit(thing: any): thing is WorkspaceTextEdit {
	return isObject(thing) && URI.isUri((<WorkspaceTextEdit>thing).resource) && isObject((<WorkspaceTextEdit>thing).edit);
}

export class ResourceEdit {

	protected constructor(readonly metadata?: WorkspaceEditMetadata) { }

	static convert(edit: WorkspaceEdit): ResourceEdit[] {


		return edit.edits.map(edit => {
			if (isWorkspaceTextEdit(edit)) {
				return new ResourceTextEdit(edit.resource, edit.edit, edit.modelVersionId, edit.metadata);
			}
			if (isWorkspaceFileEdit(edit)) {
				return new ResourceFileEdit(edit.oldUri, edit.newUri, edit.options, edit.metadata);
			}
			throw new Error('Unsupported edit');
		});
	}
}

export class ResourceTextEdit extends ResourceEdit {
	constructor(
		readonly resource: URI,
		readonly textEdit: TextEdit,
		readonly versionId?: number,
		metadata?: WorkspaceEditMetadata
	) {
		super(metadata);
	}
}

export class ResourceFileEdit extends ResourceEdit {
	constructor(
		readonly oldResource: URI | undefined,
		readonly newResource: URI | undefined,
		readonly options?: WorkspaceFileEditOptions,
		metadata?: WorkspaceEditMetadata
	) {
		super(metadata);
	}
}

export interface IBulkEditOptions {
	editor?: ICodeEditor;
	showPreview?: boolean;
	label?: string;
	quotableLabel?: string;
}

export interface IBulkEditResult {
	ariaSummary: string;
}

export interface IBulkEditService {
	readonly _serviceBrand: undefined;

	hasPreviewHandler(): boolean;

	apply(edit: ResourceEdit[], options?: IBulkEditOptions): Promise<IBulkEditResult>;
}
