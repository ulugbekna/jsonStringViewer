import * as vscode from "vscode";
import { JsonLStringHoverProvider, JsonStringHoverProvider } from "./hoverProviders";
import { JsonPath, Mapping, MappingKind, uuid } from "./typesAndUtis";
import { JsonStringFS } from "./virtualFs";

export const OPEN_CMD_ID = "jsonString.open";

export function activate(context: vscode.ExtensionContext) {
  const fsProvider = new JsonStringFS();

  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider("jsonstr", fsProvider, { isCaseSensitive: true, isReadonly: false })
  );

  // Hover providers (JSON + JSONL)
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("json", new JsonStringHoverProvider(OPEN_CMD_ID, "json"))
  );
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("jsonl", new JsonLStringHoverProvider(OPEN_CMD_ID))
  );

  // Command to open the decoded editor
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_CMD_ID, async (args: any) => {
      try {
        const { sourceUri, kind } = args as { sourceUri: string; kind: MappingKind };
        const source = vscode.Uri.parse(sourceUri);

        let mapping: Mapping;
        if (kind === "json") {
          const path = (args.path ?? []) as JsonPath;
          mapping = { id: uuid(), kind: "json", sourceUri: source, path };
        } else {
          const line = Number(args.line ?? 0);
          const char = Number(args.char ?? 0);
          mapping = { id: uuid(), kind: "jsonl", sourceUri: source, line, char };
        }

        const virtualUri = fsProvider.registerMapping(mapping);
        const doc = await vscode.workspace.openTextDocument(virtualUri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (e) {
        vscode.window.showErrorMessage(`Open in Editor failed: ${e}`);
      }
    })
  );

  // Keep virtual views updated when source documents change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((ev) => {
      fsProvider.refreshBySourceUri(ev.document.uri);
    })
  );

  // Cleanup mappings when virtual docs are closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.scheme === "jsonstr") {
        fsProvider.unregisterByUri(doc.uri);
      }
    })
  );
}

export function deactivate() { }
