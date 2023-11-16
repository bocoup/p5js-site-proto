import * as documentation from "documentation";
import fs from "fs/promises";
import matter from "gray-matter";
import { remark } from "remark";
import remarkMDX from "remark-mdx";
import { simpleGit } from "simple-git";

let fileContextToModuleMap = new Map();
let fileContextToSubmoduleMap = new Map();

const localPath = "temp/p5.js";
const srcPath = "src/**/p5.Element.js";

const modulePathTree = {};

function getModulePath(doc) {
  if (!doc) {
    return;
  }

  let prefix = `./src/pages/en/reference`;
  const module = fileContextToModuleMap[doc.context.file]?.toLowerCase();
  const submodule = fileContextToSubmoduleMap[doc.context.file]?.toLowerCase();

  // Check if module exists
  if (!module) {
    console.warn(
      `Could not find module for file ${doc.context.file} in fileContextToModuleMap`
    );
    return prefix;
  }

  let path = `${prefix}/${module}`;

  // Add submodule to path if it exists
  if (submodule && submodule !== module) {
    path += `/${submodule}`;
  }

  const pathWithFile = `${path.replace("./src/pages", "")}/${doc.name}`;

  // Create or update modulePathTree
  if (!modulePathTree[module]) {
    modulePathTree[module] = { root: {} };
  }

  if (submodule && submodule !== module) {
    if (!modulePathTree[module][submodule]) {
      modulePathTree[module][submodule] = {};
    }
    modulePathTree[module][submodule][doc.name] = pathWithFile;
  } else {
    modulePathTree[module]["root"][doc.name] = pathWithFile;
  }

  return path;
}

function convertToMDX(doc) {
  console.log(doc);
  if (!doc) {
    return;
  }

  for (const tag of doc.tags) {
    if (tag.title === "module") {
      // Store mapping of modules to their file path
      fileContextToModuleMap[doc.context.file] = tag.name;
    } else if (tag.title === "submodule") {
      // Store mapping of submodules to their parent module
      fileContextToSubmoduleMap[doc.context.file] = tag.description;
    }
  }

  const module = fileContextToModuleMap[doc.context.file];
  let submodule = fileContextToSubmoduleMap[doc.context.file];

  // Submodule is not useful when identical to module
  // Should be cleaned up in authoring
  if (submodule === module) {
    submodule = null;
  }

  // This is the module declaration, no reference needed
  if (module === doc.name) {
    return;
  }

  // p5 keeps some internal modules that we don't want to document
  if (doc.name?.startsWith("_")) {
    return;
  }

  const transformedParams = doc.params
    .map((param) => {
      // Check if the necessary properties exist
      if (
        !param.description ||
        !param.description.children ||
        (!param.type?.name && !param.type?.expression?.name)
      ) {
        return null;
      }

      // Extract the description text
      const descriptionText = param.description.children
        .map((child) =>
          child.children.map((textNode) => textNode.value).join("")
        )
        .join("");

      return {
        name: param.name,
        description: descriptionText,
        type: param.type.name ?? param.type?.expression?.name ?? "",
      };
    })
    .filter((param) => param != null);

  let descriptionText = "";

  for (const child of doc.description?.children ?? []) {
    for (const textNode of child.children ?? []) {
      switch (textNode.type) {
        case "inlineCode":
          descriptionText += `\`${textNode.value}\``;
          break;
        case "link":
          descriptionText += `[${textNode.children[0].value}](${textNode.url})`;
          break;
        case "strong":
          descriptionText += `**${textNode.children[0].value}**`;
          break;
        case "emphasis":
          descriptionText += `*${textNode.children[0].value}*`;
          break;
        case "paragraph":
          descriptionText += `${textNode.children[0].value}`;
          break;
        case "text":
        default:
          descriptionText += textNode.value;
          break;
      }
    }
  }

  // Likely intended as private
  if (!module) {
    return;
  }
  console.log(doc);
  let frontMatterArgs = {};
  try {
    frontMatterArgs = {
      layout: "@layouts/reference/SingleReferenceLayout.astro",
      title: doc.name ?? "",
      module,
      ...(submodule ? { submodule } : {}),
      file: doc.context.file.replace(/.*?(?=src)/, ""), // Get relative path from src
      // This is currently a static value but might change
      descriptionText,
      params: transformedParams,
      // Add all properties as frontmatter, except for those that are objects
      // This likely needs to be organized more deliberately
      ...Object.entries(doc)
        .filter(
          ([key, value]) =>
            typeof value !== "object" && typeof value !== "undefined"
        )
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),

      examples: doc.examples
        ? doc.examples.map((example) => example.description)
        : [],
    };

    // Create the frontmatter string
    const frontmatter = matter.stringify("", frontMatterArgs);

    // Combine all pieces of the doc into a single Markdown string
    let markdownContent = `# ${doc.name}\n`;

    // Process the Markdown content through remark and remark-mdx
    const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

    // Combine frontmatter and MDX content
    return `${frontmatter}\n${mdxContent.toString()}`;
  } catch (err) {
    console.error(`Error converting ${doc.name} to MDX: ${err}`);
    console.log(frontMatterArgs);
    return;
  }
}

const getIndexMdx = () => {
  const frontmatter = matter.stringify("", {
    title: "Reference",
  });

  let markdownContent = `# Reference\n`;
  for (const module in modulePathTree) {
    markdownContent += `## ${module}\n`;
    const submodules = modulePathTree[module];

    const scanAndAddSubmodules = (modules) => {
      for (const [key, val] of Object.entries(modules)) {
        if (typeof val === "object" && Object.keys(val).length > 0) {
          if (key !== "root") {
            markdownContent += `### ${key}\n`;
          }
          scanAndAddSubmodules(val);
        } else {
          markdownContent += `- [${key}](${val})\n`;
        }
      }
    };

    scanAndAddSubmodules(submodules);
  }

  const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

  return `${frontmatter}\n${mdxContent.toString()}`;
};

async function cloneLibraryRepo() {
  const git = simpleGit();
  const repoUrl = "https://github.com/processing/p5.js.git";

  console.log("Cloning repository...");
  await git.clone(repoUrl, localPath, ["--depth", "1", "--filter=blob:none"]);
}

async function deleteClonedLibraryRepo(path) {
  try {
    await fs.rm(path, { recursive: true, force: true });
    console.log(`Deleted cloned library source code: ${path}`);
  } catch (err) {
    console.error(`Error deleting cloned library code: ${err}`);
  }
}

async function cleanUp() {
  await deleteClonedLibraryRepo("temp");
}

async function main() {
  // await cloneLibraryRepo();

  console.log("Building reference docs...");
  console.log(`${localPath}/${srcPath}`);
  const docs = await documentation.build([`${localPath}/${srcPath}`], {
    shallow: true,
    inferPrivate: false,
  });

  for (const doc of docs) {
    const mdx = await convertToMDX(doc, matter, remark, remarkMDX);

    if (!mdx) {
      continue;
    }
    const savePath = getModulePath(doc);
    await fs.mkdir(savePath, {
      recursive: true,
    });
    await fs.writeFile(`${savePath}/${doc.name}.mdx`, mdx.toString());
  }

  /* Save reference home for navigation */
  console.log("Saving reference index...");
  const indexMdx = getIndexMdx();
  await fs.writeFile(`./src/pages/en/reference/index.mdx`, indexMdx.toString());

  // await deleteClonedLibraryRepo("temp");

  console.log("Done building reference docs!");
}

main();
