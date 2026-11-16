export function ReadableText({ text }: { text: string }) {
  if (text.length < 115) return <>{text}</>;

  const groups: string[] = [];
  let current = "";
  for (const sentence of text.split(/(?<=[.!?。！？])(?=\s)/u)) {
    if (current && current.length + sentence.length > 100) {
      groups.push(current);
      current = "";
    }
    current += sentence;
  }
  if (current) groups.push(current);
  if (groups.length < 2) return <>{text}</>;

  return <span className="readable-copy">{groups.map((group, index) => <span key={index}>{group}</span>)}</span>;
}
