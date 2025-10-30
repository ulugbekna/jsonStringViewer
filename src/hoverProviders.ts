import * as Parser from "jsonc-parser";
import * as vscode from "vscode";
import { OPEN_CMD_ID } from "./extension";
import { MappingKind, decodeJsonStringLiteral, getNodeRange, makeCommandLink } from "./typesAndUtis";


// ---------- Hover Providers ----------
export class JsonStringHoverProvider implements vscode.HoverProvider {
	constructor(private openCmdId: string, private kind: MappingKind) { }

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const docText = document.getText();
		const root = Parser.parseTree(docText);
		if (!root) { return; }

		const node = Parser.findNodeAtOffset(root, document.offsetAt(position));
		if (!node || node.type !== "string") { return; }

		const range = getNodeRange(document, node);
		const raw = document.getText(range);
		if (!/\\r|\\n|\\r\\n/.test(raw) && raw.length < 20) { return; }

		const unquoted = raw.slice(1, -1);
		const decoded = decodeJsonStringLiteral(unquoted);

		// Build stable JSON path for this node
		const path = Parser.getLocation(docText, node.offset).path;

		const args = {
			sourceUri: document.uri.toString(),
			kind: "json" as const,
			path,
		};
		const cmdUri = makeCommandLink(this.openCmdId, args);

		const md = new vscode.MarkdownString(undefined, true);
		md.appendMarkdown(`[Open in Editor](${cmdUri})\n\n`);
		md.appendCodeblock(decoded, "json");
		md.isTrusted = { enabledCommands: [this.openCmdId] };

		return new vscode.Hover(md, range);
	}
}
export class JsonLStringHoverProvider implements vscode.HoverProvider {
	constructor(private openCmdId: string) { }

	provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
		const line = document.lineAt(position.line).text;
		const tree = Parser.parseTree(line);
		if (!tree) { return; }

		const node = Parser.findNodeAtOffset(tree, position.character);
		if (!node || node.type !== "string") { return; }

		const start = document.positionAt(document.offsetAt(new vscode.Position(position.line, 0)) + node.offset);
		const end = document.positionAt(document.offsetAt(new vscode.Position(position.line, 0)) + node.offset + node.length);
		const range = new vscode.Range(start, end);

		const raw = document.getText(range);
		if (!/\\r|\\n|\\r\\n/.test(raw) && raw.length < 20) { return; }

		const unquoted = raw.slice(1, -1);
		const decoded = decodeJsonStringLiteral(unquoted);

		const args = {
			sourceUri: document.uri.toString(),
			kind: "jsonl" as const,
			line: position.line,
			char: position.character,
		};
		const cmdUri = makeCommandLink(OPEN_CMD_ID, args);

		const md = new vscode.MarkdownString(undefined, true);
		md.appendMarkdown(`[Open in Editor](${cmdUri})\n\n`);
		md.appendCodeblock(decoded, "json");
		md.isTrusted = { enabledCommands: [OPEN_CMD_ID] };

		return new vscode.Hover(md, range);
	}
}
