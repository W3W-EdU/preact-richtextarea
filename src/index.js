import { h, Component } from 'preact';
import './style.css';

const UID = Math.random().toString(32).substring(2);

const EMPTY_VALUE = '<br>';

export default class RichTextArea extends Component {
	constructor(props) {
		super(props);
		this.componentDidUpdate = this.componentDidUpdate.bind(this);
		this.updateHeight = this.updateHeight.bind(this);
		this.handleEvent = this.handleEvent.bind(this);
		this.doFocus = this.doFocus.bind(this);
	}

	exec(command, ...args) {
		let doc = this.getDocument();
		if (doc) return doc[command](...args);
	}

	execCommand(command, ...args) {
		return this.exec('execCommand', command, ...args);
	}

	queryCommandState(command) {
		return this.exec('queryCommandState', command);
	}

	queryCommandValue(command) {
		return this.exec('queryCommandValue', command);
	}

	componentDidMount() {
		this.updateHeightTimer = setInterval(this.updateHeight, 1000);
	}

	componentWillUnmount() {
		clearInterval(this.updateHeightTimer);
	}

	shouldComponentUpdate({ value, stylesheet, placeholder, ...props }) {
		for (let i in props) if (props[i]!==this.props[i]) return true;
		this.props = { ...this.props, value, placeholder, stylesheet };
		this.componentDidUpdate();
		return false;
	}

	componentDidUpdate() {
		clearTimeout(this.updateTimer);
		this.setup();

		let editor = this.getEditor();
		if (!editor) {
			this.editorRetries = (this.editorRetries || 0) + 1;
			this.updateTimer = setTimeout(this.componentDidUpdate, this.editorRetries>10 ? 100 : 1);
			return;
		}
		this.editorRetries = 0;

		let value = this.props.value || EMPTY_VALUE,
			stylesheet = this.props.stylesheet,
			current = editor.innerHTML;

		if (stylesheet!==this.stylesheet) {
			this.setStyleSheet(stylesheet);
		}

		if (this.placeholderShowing===true && current===this.props.placeholder) {
			current = EMPTY_VALUE;
		}
		if (current!==value) {
			editor.innerHTML = value;
		}
		this.updatePlaceholder();
		this.updateHeight();
	}

	setStyleSheet(stylesheet) {
		this.stylesheet = stylesheet;
		let doc = this.getDocument(),
			s = doc.getElementById('prtcss'+UID);
		if (s) s.parentNode.removeChild(s);

		let head = doc.head || doc.getElementsByTagName('head')[0];
		if (!head) head = doc.body.parentNode.insertBefore(doc.createElement('head'), doc.body);

		s = doc.createElement('style');
		s.setAttribute('id', 'prtcss'+UID);
		s.appendChild(doc.createTextNode(stylesheet));
		head.appendChild(s);
	}

	setup() {
		let doc = this.getDocument();
		if (!doc || (doc.body && doc.body._hasbeensetup===true)) return;

		if (!doc.body) {
			doc.open();
			doc.write('<!DOCTYPE html><html><body contentEditable></body></html>');
			doc.close();
		}
		doc.designMode = 'on';
		doc.documentElement.style.cursor = 'text';
		doc.documentElement.style.overflowY = doc.body.style.overflowY = 'hidden';
		doc.body.style.minHeight = '1.2em';
		doc.body.contentEditable = true;
		doc.body._hasbeensetup = true;
		let win = this.getFrame().contentWindow;
		win.onfocus = win.onblur = win.oninput = win.onchange = this.handleEvent;
		win.onscroll = win.onload = this.updateHeight;
	}

	updateHeight() {
		clearTimeout(this.uht);
		this.uht = null;
		let doc = this.getDocument(),
			br = doc && doc._br;
		if (!doc) return;
		if (!br) {
			br = doc._br = doc.createElement('div');
			br.style.cssText = 'position:relative;overflow:hidden;clear:both;';
		}
		doc.body.appendChild(br);
		let ph = br.offsetTop + doc.documentElement.offsetHeight - doc.body.offsetHeight;
		doc.body.removeChild(br);

		let frame = this.getFrame();
		if (ph!==frame.offsetHeight) {
			frame.style.height = ph+'px';
		}
	}

	getFrame() {
		return this.base && this.base.firstChild;
	}

	getDocument() {
		let frame = this.getFrame();
		return frame && frame.contentWindow && frame.contentWindow.document;
	}

	getEditor() {
		let doc = this.getDocument();
		return doc && doc.body;
	}

	getHandler(type) {
		for (let i in this.props) if (i.toLowerCase()==='on'+type) return this.props[i];
	}

	handleEvent({ type, target }) {
		let fn = this.getHandler(type),
			editor = this.getEditor(),
			value = editor.innerHTML;
		target = editor || target;
		if (type==='focus' || type==='blur') {
			this.focussed = type==='focus';
			this.updatePlaceholder();
			if (type==='focus') target.focus();
		}
		if (fn) fn({ value, type, target, currentTarget:this });
		if (!this.uht) {
			this.uht = setTimeout(this.updateHeight, 20);
		}
	}

	updatePlaceholder() {
		let { placeholder } = this.props,
			editor = this.getEditor(),
			value = editor.innerHTML,
			norm = this.normalizeEmptyValue(value),
			show = (!norm || norm===EMPTY_VALUE || norm===placeholder) && placeholder && !this.focussed;

		if (show===this.placeholderShowing) return;
		this.placeholderShowing = show;

		if (show) {
			if (!norm) editor.innerHTML = placeholder;
			this.base.setAttribute('is-placeholder', 'true');
		}
		else {
			if (value===placeholder) editor.innerHTML = EMPTY_VALUE;
			this.base.removeAttribute('is-placeholder');
		}
	}

	normalizeEmptyValue(value) {
		return typeof value==='string' ? value.replace(/^[\s\n]*?(<br\s*?\/?>)?[\s\n]*?$/gi, '') : '';
	}

	doFocus(e) {
		let a = this.getEditor();
		if (a) a.focus();
		if (e) return e.preventDefault(), false;
	}

	render({ value, class:cl, className, placeholder, stylesheet, ...props }) {
		for (let i in props) if (props.hasOwnProperty(i) && i.match(/^on/i) && typeof props[i]==='function') delete props[i];
		return (
			<richtextarea class={{
				'preact-richtextarea': true,
				[cl]: cl,
				[className]: className
			}} {...props} onFocus={this.doFocus} tabIndex=" " is-placeholder={ (!value && !!placeholder) || null }>
				<iframe />
			</richtextarea>
		);
	}
}
