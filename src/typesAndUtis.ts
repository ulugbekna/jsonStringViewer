import * as crypto from "crypto";
import * as Parser from "jsonc-parser";
import * as vscode from "vscode";

export type JsonPath = (string | number)[];
export type MappingKind = "json" | "jsonl";
interface BaseMapping {
	id: string;
	kind: MappingKind;
	sourceUri: vscode.Uri; // original document
}
export interface JsonMapping extends BaseMapping {
	kind: "json";
	path: JsonPath;
}
export interface JsonlMapping extends BaseMapping {
	kind: "jsonl";
	line: number;
	// character offset of the string node within the line, best-effort anchor
	char: number;
}
export type Mapping = JsonMapping | JsonlMapping;
export function uuid() {
	return crypto.randomBytes(16).toString("hex");
}
export function decodeJsonStringLiteral(rawWithoutQuotes: string): string {
	// Use JSON.parse on a synthesized string literal to handle escapes reliably.
	// If raw contains invalid escapes (JSONC edge-cases), fall back to loose fixes.
	try {
		return JSON.parse(`"${rawWithoutQuotes.replace(/"/g, '\\"')}"`);
	} catch {
		// Fallback: minimally handle \n, \r, \t, and escaped quotes/backslashes
		return rawWithoutQuotes
			.replace(/\\n/g, "\n")
			.replace(/\\r/g, "\r")
			.replace(/\\t/g, "\t")
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
}
export function encodeToJsonStringLiteral(text: string): string {
	// JSON.stringify returns a quoted JSON string literal; we need that form.
	return JSON.stringify(text);
}
function toVSCodeRange(document: vscode.TextDocument, offset: number, length: number) {
	return new vscode.Range(document.positionAt(offset), document.positionAt(offset + length));
}
export function getNodeRange(doc: vscode.TextDocument, node: Parser.Node): vscode.Range {
	return toVSCodeRange(doc, node.offset, node.length);
}
export function makeCommandLink(command: string, args: unknown): string {
	// Properly encode args for a command URI inside Markdown.
	const encoded = encodeURIComponent(JSON.stringify(args));
	const uri = vscode.Uri.parse(`command:${command}?${encoded}`);
	return uri.toString();
}
