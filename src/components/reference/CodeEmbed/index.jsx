const CodeEmbed = ({ code }) => {
  return (
    <div style={{ backgroundColor: "lightgray", padding: "1rem" }}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeEmbed;
