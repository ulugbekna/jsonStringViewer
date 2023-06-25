import * as vscode from "vscode";
import * as Parser from "jsonc-parser";

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.languages.registerHoverProvider("json", new JsonStringHoverProvider())
	);
}

class JsonStringHoverProvider implements vscode.HoverProvider {

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {

		const docContents = document.getText();
		const parseTree = Parser.parseTree(docContents);

		if (parseTree === undefined) { return; }

		const nodeAtCursor = Parser.findNodeAtOffset(parseTree, document.offsetAt(position));

		if (nodeAtCursor === undefined || nodeAtCursor.type !== 'string') { return; }

		const start = document.positionAt(nodeAtCursor.offset);
		const end = document.positionAt(nodeAtCursor.offset + nodeAtCursor.length);
		const strRange = new vscode.Range(start, end);
		const str = document.getText(strRange);

		if (!str.match(/\\r|\\n|\\r\\n/)) { return; }

		const unquotedStr = str.slice(1, -1);

		const whitespaceFixedStr = unquotedStr.replace(/\\n/g, '\n').replace(/\\t/g, '	');

		return new vscode.Hover(
			new vscode.MarkdownString(whitespaceFixedStr),
			strRange
		);
	}
}

export function deactivate() { }
