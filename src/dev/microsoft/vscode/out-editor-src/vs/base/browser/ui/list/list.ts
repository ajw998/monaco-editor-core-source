/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GestureEvent } from 'vs/base/browser/touch';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IDragAndDropData } from 'vs/base/browser/dnd';

export interface IListVirtualDelegate<T> {
	getHeight(element: T): number;
	getTemplateId(element: T): string;
	hasDynamicHeight?(element: T): boolean;
	setDynamicHeight?(element: T, height: number): void;
}

export interface IListRenderer<T, TTemplateData> {
	readonly templateId: string;
	renderTemplate(container: HTMLElement): TTemplateData;
	renderElement(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
	disposeElement?(element: T, index: number, templateData: TTemplateData, height: number | undefined): void;
	disposeTemplate(templateData: TTemplateData): void;
}

export interface IListEvent<T> {
	elements: T[];
	indexes: number[];
	browserEvent?: UIEvent;
}

export interface IListMouseEvent<T> {
	browserEvent: MouseEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListTouchEvent<T> {
	browserEvent: TouchEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListGestureEvent<T> {
	browserEvent: GestureEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListDragEvent<T> {
	browserEvent: DragEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface IListContextMenuEvent<T> {
	browserEvent: UIEvent;
	index: number | undefined;
}

export interface IIdentityProvider<T> {
	getId(element: T): { toString(): string; };
}

export interface IKeyboardNavigationLabelProvider<T> {

	/**
	 * Return a keyboard navigation label(s) which will be used by
	 * the list for filtering/navigating. Return `undefined` to make
	 * an element always match.
	 */
	getKeyboardNavigationLabel(element: T): { toString(): string | undefined; } | { toString(): string | undefined; }[] | undefined;
}

export interface IKeyboardNavigationDelegate {
	mightProducePrintableCharacter(event: IKeyboardEvent): boolean;
}

export const enum ListDragOverEffect {
	Copy,
	Move
}

export interface IListDragOverReaction {
	accept: boolean;
	effect?: ListDragOverEffect;
	feedback?: number[]; // use -1 for entire list
}

export interface IListDragAndDrop<T> {
	getDragURI(element: T): string | null;
	getDragLabel?(elements: T[], originalEvent: DragEvent): string | undefined;
	onDragStart?(data: IDragAndDropData, originalEvent: DragEvent): void;
	onDragOver(data: IDragAndDropData, targetElement: T | undefined, targetIndex: number | undefined, originalEvent: DragEvent): boolean | IListDragOverReaction;
	drop(data: IDragAndDropData, targetElement: T | undefined, targetIndex: number | undefined, originalEvent: DragEvent): void;
	onDragEnd?(originalEvent: DragEvent): void;
}

export class ListError extends Error {

	constructor(user: string, message: string) {
		super(`ListError [${user}] ${message}`);
	}
}
