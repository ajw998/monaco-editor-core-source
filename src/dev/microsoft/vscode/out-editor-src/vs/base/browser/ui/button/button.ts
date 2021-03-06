/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./button';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Color } from 'vs/base/common/color';
import { mixin } from 'vs/base/common/objects';
import { Event as BaseEvent, Emitter } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { Gesture, EventType as TouchEventType } from 'vs/base/browser/touch';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { addDisposableListener, IFocusTracker, EventType, EventHelper, trackFocus, reset } from 'vs/base/browser/dom';

export interface IButtonOptions extends IButtonStyles {
	readonly title?: boolean | string;
	readonly supportIcons?: boolean;
	readonly secondary?: boolean;
}

export interface IButtonStyles {
	buttonBackground?: Color;
	buttonHoverBackground?: Color;
	buttonForeground?: Color;
	buttonSecondaryBackground?: Color;
	buttonSecondaryHoverBackground?: Color;
	buttonSecondaryForeground?: Color;
	buttonBorder?: Color;
}

const defaultOptions: IButtonStyles = {
	buttonBackground: Color.fromHex('#0E639C'),
	buttonHoverBackground: Color.fromHex('#006BB3'),
	buttonForeground: Color.white
};

export interface IButton extends IDisposable {
}

export class Button extends Disposable implements IButton {

	private _element: HTMLElement;
	private options: IButtonOptions;

	private buttonBackground: Color | undefined;
	private buttonHoverBackground: Color | undefined;
	private buttonForeground: Color | undefined;
	private buttonSecondaryBackground: Color | undefined;
	private buttonSecondaryHoverBackground: Color | undefined;
	private buttonSecondaryForeground: Color | undefined;
	private buttonBorder: Color | undefined;

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super();

		this.options = options || Object.create(null);
		mixin(this.options, defaultOptions, false);

		this.buttonForeground = this.options.buttonForeground;
		this.buttonBackground = this.options.buttonBackground;
		this.buttonHoverBackground = this.options.buttonHoverBackground;

		this.buttonSecondaryForeground = this.options.buttonSecondaryForeground;
		this.buttonSecondaryBackground = this.options.buttonSecondaryBackground;
		this.buttonSecondaryHoverBackground = this.options.buttonSecondaryHoverBackground;

		this.buttonBorder = this.options.buttonBorder;

		this._element = document.createElement('a');
		this._element.classList.add('monaco-button');
		this._element.tabIndex = 0;
		this._element.setAttribute('role', 'button');

		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = false;
			if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
				this._onDidClick.fire(e);
				eventHandled = true;
			} else if (event.equals(KeyCode.Escape)) {
				this._element.blur();
				eventHandled = true;
			}

			if (eventHandled) {
				EventHelper.stop(event, true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.setHoverBackground();
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.applyStyles(); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => this.setHoverBackground()));
		this._register(this.focusTracker.onDidBlur(() => this.applyStyles())); // restore standard styles

		this.applyStyles();
	}

	private setHoverBackground(): void {
		let hoverBackground;
		if (this.options.secondary) {
			hoverBackground = this.buttonSecondaryHoverBackground ? this.buttonSecondaryHoverBackground.toString() : null;
		} else {
			hoverBackground = this.buttonHoverBackground ? this.buttonHoverBackground.toString() : null;
		}
		if (hoverBackground) {
			this._element.style.backgroundColor = hoverBackground;
		}
	}

	style(styles: IButtonStyles): void {
		this.buttonForeground = styles.buttonForeground;
		this.buttonBackground = styles.buttonBackground;
		this.buttonHoverBackground = styles.buttonHoverBackground;
		this.buttonSecondaryForeground = styles.buttonSecondaryForeground;
		this.buttonSecondaryBackground = styles.buttonSecondaryBackground;
		this.buttonSecondaryHoverBackground = styles.buttonSecondaryHoverBackground;
		this.buttonBorder = styles.buttonBorder;

		this.applyStyles();
	}

	private applyStyles(): void {
		if (this._element) {
			let background, foreground;
			if (this.options.secondary) {
				foreground = this.buttonSecondaryForeground ? this.buttonSecondaryForeground.toString() : '';
				background = this.buttonSecondaryBackground ? this.buttonSecondaryBackground.toString() : '';
			} else {
				foreground = this.buttonForeground ? this.buttonForeground.toString() : '';
				background = this.buttonBackground ? this.buttonBackground.toString() : '';
			}

			const border = this.buttonBorder ? this.buttonBorder.toString() : '';

			this._element.style.color = foreground;
			this._element.style.backgroundColor = background;

			this._element.style.borderWidth = border ? '1px' : '';
			this._element.style.borderStyle = border ? 'solid' : '';
			this._element.style.borderColor = border;
		}
	}

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string) {
		this._element.classList.add('monaco-text-button');
		if (this.options.supportIcons) {
			reset(this._element, ...renderLabelWithIcons(value));
		} else {
			this._element.textContent = value;
		}
		if (typeof this.options.title === 'string') {
			this._element.title = this.options.title;
		} else if (this.options.title) {
			this._element.title = value;
		}
	}

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
		}
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}
}
