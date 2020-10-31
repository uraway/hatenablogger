"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import Hatenablog from "./hatenablog";
import Hatenafotolife from "./hatenafotolife";
import { basename } from "path";

const contextCommentRegExp = /^<!--([\s\S]*?)-->\n?/;
type Context = {
  id?: string;
  title: string;
  categories: string[];
  draft: "yes" | "no";
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "hatenablogger" v0.2.0 is now active!'
  );
  const hatenablog = new Hatenablog();
  const hatenafotolife = new Hatenafotolife();

  const postOrUpdate = async () => {
    const textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
      return;
    }
    const content = textEditor.document.getText();
    const context = parseContext(content);

    const titleValue = context.title ?? "";
    const categoriesValue = context.categories ?? "";

    const inputTitle = await vscode.window.showInputBox({
      placeHolder: "Entry title",
      prompt: "Please input an entry title",
      value: titleValue,
    });

    if (!inputTitle) {
      return vscode.window.showErrorMessage("hatenablogger was cancelled");
    }

    const inputCategories = await vscode.window.showInputBox({
      placeHolder: "Categories",
      prompt: "Please input categories. (Comma deliminated)",
      value: categoriesValue,
    });

    const inputPublished = await vscode.window.showInputBox({
      placeHolder: "yes",
      prompt: 'Do you want to publish it? Type "yes" or save as draft',
    });

    if (inputPublished === undefined) {
      return vscode.window.showErrorMessage("hatenablogger was cancelled");
    }

    const title = inputTitle;
    const categories = inputCategories ? inputCategories.split(",") : [];
    const draft: "yes" | "no" = inputPublished === "yes" ? "no" : "yes";

    const options = {
      id: context?.id,
      title,
      content: removeContextComment(content),
      categories,
      draft,
    };

    try {
      const res = await hatenablog.postOrUpdate(options);
      const id = res.entry.id._.match(/^tag:[^:]+:[^-]+-[^-]+-\d+-(\d+)$/)?.[1];
      const { hatenaId, blogId } = vscode.workspace.getConfiguration(
        "hatenablogger"
      );
      const entryURL =
        draft !== "yes"
          ? res.entry.link[1].$.href
          : `http://blog.hatena.ne.jp/${hatenaId}/${blogId}/edit?entry=${id}`;

      saveContext({
        id,
        title,
        categories,
        draft,
      });

      vscode.window.showInformationMessage(
        `Successfully ${context ? "updated" : "posted"} at ${entryURL}`
      );
    } catch (err) {
      console.error(err);
      vscode.window.showErrorMessage(err.toString());
    }
  };

  const uploadImage = async () => {
    const uri = await vscode.window.showOpenDialog({});
    if (!uri) {
      return;
    }
    const file = uri[0];
    const textEditor = vscode.window.activeTextEditor;

    if (textEditor && textEditor.selection.isEmpty) {
      const position = textEditor.selection.active;
      vscode.window.showInformationMessage("Uploading image...");

      const title = await vscode.window.showInputBox({
        placeHolder: "Title",
        prompt: "Please input title",
        value: basename(file.fsPath),
      });
      try {
        const res = await hatenafotolife.upload({
          file: file.fsPath,
          title: title ?? basename(file.fsPath),
        });
        const imageurl = res.entry["hatena:imageurl"]._;
        const markdown = `![${title}](${imageurl})`;
        textEditor.edit((edit) => edit.insert(position, markdown));
        vscode.window.showInformationMessage("Successfully image uploaded!");
      } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage(err.toString());
      }
    }
  };

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  const disposables = [];
  disposables.push(
    vscode.commands.registerCommand("extension.postOrUpdate", postOrUpdate)
  );

  disposables.push(
    vscode.commands.registerCommand("extension.uploadImage", uploadImage)
  );

  function saveContext(context: Context) {
    const textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
      return;
    }
    const fileContent = removeContextComment(textEditor.document.getText());
    const comment = `<!--\n${JSON.stringify(context)}\n-->\n${fileContent}`;

    const firstPosition = new vscode.Position(0, 0);
    const lastPosition = new vscode.Position(textEditor.document.lineCount, 0);
    textEditor.edit((edit) =>
      edit.replace(new vscode.Range(firstPosition, lastPosition), comment)
    );
  }

  function parseContext(content: string) {
    const comment = content.match(contextCommentRegExp);
    if (comment) {
      return JSON.parse(comment[1]);
    }
    return null;
  }

  function removeContextComment(content: string) {
    return content.replace(contextCommentRegExp, "");
  }

  context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}
