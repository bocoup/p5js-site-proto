import { useState } from "preact/hooks";

const InteractiveComponentTest = () => {
  const [count, setCount] = useState(0);
  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  return (
    <div>
      <h2>Interactive Component Test</h2>
      <p>Count: {count}</p>
      <button onClick={decrement}>Decrement</button>
      <button onClick={increment}>Increment</button>
    </div>
  );
};

export default InteractiveComponentTest;
