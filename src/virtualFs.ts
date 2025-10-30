import * as Parser from "jsonc-parser";
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";
import { decodeJsonStringLiteral, encodeToJsonStringLiteral, getNodeRange, JsonlMapping, JsonMapping, Mapping } from "./typesAndUtis";


// ---------- Virtual FS (editable) for decoded views ----------
export class JsonStringFS implements vscode.FileSystemProvider {
	private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this._onDidChangeFile.event;

	// id -> mapping
	private registry = new Map<string, Mapping>();

	// uri path is `/<id>.txt`; we index by the id portion
	private idFromUri(uri: vscode.Uri): string | undefined {
		const m = /^\/([^/]+)\.txt$/.exec(uri.path);
		return m?.[1];
	}

	registerMapping(mapping: Mapping): vscode.Uri {
		this.registry.set(mapping.id, mapping);
		// Use nice file name for tab title
		const base = mapping.sourceUri.path.split("/").pop() ?? "source";
		const suffix = mapping.kind === "json"
			? "#path"
			: `#L${(mapping as JsonlMapping).line + 1}`;
		const name = `${base}${suffix}.txt`;
		return vscode.Uri.from({ scheme: "jsonstr", path: `/${mapping.id}.txt`, fragment: name });
	}

	unregisterByUri(uri: vscode.Uri) {
		const id = this.idFromUri(uri);
		if (id) { this.registry.delete(id); }
	}

	watch(): vscode.Disposable { return new vscode.Disposable(() => { }); }

	// Minimal stat implementation
	stat(uri: vscode.Uri): vscode.FileStat {
		return {
			type: vscode.FileType.File,
			ctime: 0,
			mtime: Date.now(),
			size: 0,
		};
	}

	readDirectory(): [string, vscode.FileType][] { return []; }
	createDirectory(): void { }
	delete(): void { }
	rename(): void { }

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const id = this.idFromUri(uri);
		if (!id) { throw vscode.FileSystemError.FileNotFound(); }

		const mapping = this.registry.get(id);
		if (!mapping) { throw vscode.FileSystemError.FileNotFound(); }

		const sourceDoc = await vscode.workspace.openTextDocument(mapping.sourceUri);

		let value = "";
		if (mapping.kind === "json") {
			const root = Parser.parseTree(sourceDoc.getText());
			if (!root) { return new TextEncoder().encode(""); }
			const node = Parser.findNodeAtLocation(root, (mapping as JsonMapping).path);
			if (!node || node.type !== "string") { return new TextEncoder().encode(""); }
			const raw = sourceDoc.getText(getNodeRange(sourceDoc, node));
			const unquoted = raw.slice(1, -1);
			value = decodeJsonStringLiteral(unquoted);
		} else {
			const { line, char } = mapping as JsonlMapping;
			if (line < 0 || line >= sourceDoc.lineCount) { return new TextEncoder().encode(""); }
			const lineText = sourceDoc.lineAt(line).text;
			const tree = Parser.parseTree(lineText);
			if (!tree) { return new TextEncoder().encode(""); }
			// Prefer exact string at stored char offset; otherwise first string
			let node = Parser.findNodeAtOffset(tree, Math.max(0, Math.min(char, lineText.length)));
			if (!node || node.type !== "string") {
				const all = collectStringNodes(tree);
				node = all[0];
			}
			if (!node || node.type !== "string") { return new TextEncoder().encode(""); }
			const raw = lineText.substring(node.offset, node.offset + node.length);
			const unquoted = raw.slice(1, -1);
			value = decodeJsonStringLiteral(unquoted);
		}

		return new TextEncoder().encode(value);
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, opts: { create: boolean; overwrite: boolean; }): Promise<void> {
		const id = this.idFromUri(uri);
		if (!id) { throw vscode.FileSystemError.FileNotFound(); }
		const mapping = this.registry.get(id);
		if (!mapping) { throw vscode.FileSystemError.FileNotFound(); }

		const decoded = new TextDecoder().decode(content);
		const literal = encodeToJsonStringLiteral(decoded); // includes quotes

		const sourceDoc = await vscode.workspace.openTextDocument(mapping.sourceUri);

		if (mapping.kind === "json") {
			const fullText = sourceDoc.getText();
			const root = Parser.parseTree(fullText);
			if (!root) { return; }

			const node = Parser.findNodeAtLocation(root, (mapping as JsonMapping).path);
			if (!node || node.type !== "string") { return; }

			const range = getNodeRange(sourceDoc, node);
			const edit = new vscode.WorkspaceEdit();
			edit.replace(mapping.sourceUri, range, literal);
			await vscode.workspace.applyEdit(edit);
		} else {
			const { line } = mapping as JsonlMapping;
			if (line < 0 || line >= sourceDoc.lineCount) { return; }
			const lineText = sourceDoc.lineAt(line).text;
			const tree = Parser.parseTree(lineText);
			if (!tree) { return; }
			// Replace the first string node on the line (or the one near our char anchor)
			const near = Parser.findNodeAtOffset(tree, (mapping as JsonlMapping).char);
			let strNode = near && near.type === "string" ? near : collectStringNodes(tree)[0];
			if (!strNode) { return; }

			const before = lineText.substring(0, strNode.offset);
			const after = lineText.substring(strNode.offset + strNode.length);
			const newLine = before + literal + after;

			const lineRange = new vscode.Range(
				new vscode.Position(line, 0),
				new vscode.Position(line, lineText.length)
			);
			const edit = new vscode.WorkspaceEdit();
			edit.replace(mapping.sourceUri, lineRange, newLine);
			await vscode.workspace.applyEdit(edit);
		}

		// Notify that our virtual file changed (so open editors refresh if VS Code asks).
		this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
	}

	// External trigger to refresh virtual editors when source changes
	refreshBySourceUri(source: vscode.Uri) {
		for (const [id, m] of this.registry) {
			if (m.sourceUri.toString() === source.toString()) {
				const uri = vscode.Uri.from({ scheme: "jsonstr", path: `/${id}.txt` });
				this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
			}
		}
	}
}
function collectStringNodes(root: Parser.Node): Parser.Node[] {
	const acc: Parser.Node[] = [];
	const visit = (n: Parser.Node) => {
		if (n.type === "string") { acc.push(n); }
		if ((n as any).children) { for (const c of (n as any).children as Parser.Node[]) { visit(c); } }
		if ((n as any).properties) { for (const p of (n as any).properties as Parser.Node[]) { visit(p); } }
	};
	visit(root);
	return acc;
}
