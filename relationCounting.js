import fs from "fs";

const inputFile = "../../5IIR_EXAMS_cours/uml/d_class_plantUML.txt";
const outputFile = "./class-relations.json";

const content = fs.readFileSync(inputFile, "utf8");

// Matches most PlantUML relationship types
const relationRegex =
/^\s*([A-Za-z_]\w*)\b.*?[-.o*+<#|]+[<>-]+[-.o*+<#|]*.*?\b([A-Za-z_]\w*)\b/gm;
const counts = {};

let match;

while ((match = relationRegex.exec(content)) !== null) {
  const left = match[1];
  const right = match[2];

  counts[left] = (counts[left] || 0) + 1;

  // Don't count self-relations twice
  if (left !== right) {
    counts[right] = (counts[right] || 0) + 1;
  }
}

const result = Object.entries(counts)
  .map(([className, relations]) => ({
    className,
    relations,
  }))
  .sort((a, b) => b.relations - a.relations);

// Write as formatted JSON
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf8");

console.log(`Results written to ${outputFile}`);