import * as Parser from "jsonc-parser";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.languages.registerHoverProvider("json", new JsonStringHoverProvider())
	);

	context.subscriptions.push(
		vscode.languages.registerHoverProvider("jsonl", new JsonLStringHoverProvider())
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

		if (!str.match(/\\r|\\n|\\r\\n/) && str.length < 20) { return; }

		const unquotedStr = str.slice(1, -1);

		const whitespaceFixedStr = unquotedStr.replace(/\\n/g, '\n').replace(/\\t/g, '	');

		return new vscode.Hover(
			new vscode.MarkdownString(`\`\`\`markdown\n${whitespaceFixedStr}\n\`\`\``),
			strRange
		);
	}
}

class JsonLStringHoverProvider implements vscode.HoverProvider {

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {

		const line = document.lineAt(position.line);
		const docContents = line.text;
		const parseTree = Parser.parseTree(docContents);

		if (parseTree === undefined) { return; }

		const nodeAtCursor = Parser.findNodeAtOffset(parseTree, position.character);

		if (nodeAtCursor === undefined || nodeAtCursor.type !== 'string') { return; }

		const start = document.positionAt(nodeAtCursor.offset);
		const end = document.positionAt(nodeAtCursor.offset + nodeAtCursor.length);
		const strRange = new vscode.Range(start, end);
		const str = document.getText(strRange);

		if (!str.match(/\\r|\\n|\\r\\n/) && str.length < 20) { return; }

		const unquotedStr = str.slice(1, -1);

		const whitespaceFixedStr = unquotedStr.replace(/\\n/g, '\n').replace(/\\t/g, '	');

		return new vscode.Hover(
			new vscode.MarkdownString(`\`\`\`markdown\n${whitespaceFixedStr}\n\`\`\``),
			strRange
		);
	}
}

export function deactivate() { }
