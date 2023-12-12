import { useState } from "preact/hooks";
import { minimalSetup } from "codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";

import { CodeFrame } from "../../CodeFrame";

// interface CodeEmbedProps {
//   initialValue?: string;
//   editable: boolean;
//   previewable: boolean;
// }
export const CodeEmbedCodeMirror = (props) => {
  const [codeString, setCodeString] = useState(props.initialValue ?? "");
  const [previewCodeString, setPreviewCodeString] = useState(codeString);

  return (
    <>
      <CodeMirror
        value={codeString}
        theme="light"
        extensions={[minimalSetup, javascript()]}
        onChange={(val) => setCodeString(val)}
        editable={props.editable}
      />
      {props.previewable ? (
        <>
          <button
            onClick={() => {
              console.log("updating code");
              setPreviewCodeString(codeString);
            }}
          >
            Run Code
          </button>
          <CodeFrame code={previewCodeString} />
        </>
      ) : null}
    </>
  );
};

export default CodeEmbedCodeMirror;
