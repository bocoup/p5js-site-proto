import { useEffect, useRef, useState } from "preact/hooks";
import { createEditor } from "prism-code-editor";
import { copyButton } from "prism-code-editor/copy-button";
import { matchBrackets } from "prism-code-editor/match-brackets";
import { indentGuides } from "prism-code-editor/guides";
import "prism-code-editor/grammars/javascript";

import { CodeFrame } from "../../CodeFrame";

/*
 * A more featured code embed component that uses Prism-Code-Editor
 *
 * Props: {
 *   initialValue?: string;
 *   editable: boolean;
 *   previewable: boolean;
 * }
 */
export const CodeEmbedPrism = (props) => {
  //  < HTMLDivElement >
  const divRef = useRef(null);
  // < PrismCodeEditor >
  const editorRef = useRef(null);
  const [codeString, setCodeString] = useState(props.initialValue ?? "");

  useEffect(() => {
    const editor = (editorRef.current = createEditor(
      divRef.current,
      {
        language: "javascript",
        value: props.initialValue ?? "",
        theme: "prism",
        insertSpaces: true,
        tabSize: 2,
        readOnly: !props.editable,
        wordWrap: true,
      },
      copyButton(),
      matchBrackets(),
      indentGuides()
    ));

    divRef.current.querySelector("textarea").ariaLabel = "Code Editor";

    return editor.remove;
  }, []);

  return (
    <>
      <div ref={divRef} />
      {props.previewable ? (
        <>
          <button
            onClick={() => {
              console.log("updating code");
              setCodeString(editorRef.current.value);
            }}
          >
            Run Code
          </button>
          <CodeFrame code={codeString} />
        </>
      ) : null}
    </>
  );
};

// css imports for bundling
import "prism-code-editor/layout.css";
import "prism-code-editor/scrollbar.css";
import "prism-code-editor/copy-button.css";
import "prism-code-editor/themes/vs-code-light.css";

export default CodeEmbedPrism;
