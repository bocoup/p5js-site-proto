/*
 * A simple code embed component that uses only plain HTML.
 */
const CodeEmbed = ({ code }) => {
  return (
    <div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeEmbed;
