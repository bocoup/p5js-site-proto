import fs from "fs/promises";
import matter from "gray-matter";
import { remark } from "remark";
import remarkMDX from "remark-mdx";
import { simpleGit } from "simple-git";
import { exec } from "child_process";

const localPath = "in/p5.js";
const jsonFilePath = "./out/data.json";

const classMethodPreviews = {};
const modulePathTree = {
  modules: {},
  classes: {},
};

/** MAIN */

async function main() {
  await cloneLibraryRepoIfNeeded();

  const docs = await buildDocs();

  // Class items also covers the functions that
  // p5 makes globally available
  const classItemMDXDocs = await classItemsToMDX(docs);
  await saveMDX(classItemMDXDocs);
  // Do in two separate steps so that class MDX
  // can reference classitems
  const classMDXDocs = await classesToMDX(docs);
  await saveMDX(classMDXDocs);

  // Build the reference file differently
  const indexMdx = getIndexMdx();
  await fs.writeFile(`./src/pages/en/reference/index.mdx`, indexMdx.toString());

  console.log("Done building reference docs!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/** SETUP */

async function cloneLibraryRepo() {
  const git = simpleGit();
  const repoUrl = "https://github.com/processing/p5.js.git";

  console.log("Cloning repository...");
  try {
    await git.clone(repoUrl, localPath, ["--depth", "1", "--filter=blob:none"]);
    console.log("Repository cloned successfully.");
    await fixForAbsolutePathInPreprocessor();
  } catch (err) {
    console.error(`Error cloning repo: ${err}`);
  }
}

// This is a fix for the use of an absolute path in the preprocessor.js file in p5.js
async function fixForAbsolutePathInPreprocessor() {
  try {
    const preprocessorPath = `${localPath}/docs/preprocessor.js`;

    let preprocessorContent = await fs.readFile(preprocessorPath, "utf8");

    // Modify the absolute path in the preprocessor file
    preprocessorContent = preprocessorContent.replace(
      "path.join(process.cwd(), 'docs', 'parameterData.json')",
      `path.join(process.cwd(), '${localPath}/docs', 'parameterData.json')`
    );

    await fs.writeFile(preprocessorPath, preprocessorContent, "utf8");
    console.log("Preprocessor file modified successfully.");
  } catch (err) {
    console.error(`Error modifying absolute path in preprocessor: ${err}`);
  }
}

/** IO */

async function loadDocsFromJson() {
  console.log("Loading docs from JSON file...");
  try {
    const jsonData = await fs.readFile(jsonFilePath, "utf8");
    const docs = JSON.parse(jsonData);
    return docs;
  } catch (err) {
    console.error(`Error loading docs from JSON file: ${err}`);
    return [];
  }
}

async function saveMDX(mdxDocs) {
  console.log("Saving MDX...");
  try {
    for (const mdxDoc of mdxDocs) {
      await fs.mkdir(mdxDoc.savePath, {
        recursive: true,
      });
      await fs.writeFile(
        `${mdxDoc.savePath}/${mdxDoc.name}.mdx`,
        mdxDoc.mdx.toString()
      );
    }
  } catch (err) {
    console.error(`Error saving MDX: ${err}`);
  }
}

/** PARSING DOCS */

async function cloneLibraryRepoIfNeeded() {
  const currentRepoExists =
    (await fileExistsAt(localPath)) &&
    (await isModifiedWithin24Hours(localPath));
  if (!currentRepoExists) {
    await cloneLibraryRepo();
  } else {
    console.log("Library repo already exists, skipping clone...");
  }
}

async function buildDocs() {
  console.log("Loading docs from JSON file...");
  const currentYUIBuildExists =
    (await fileExistsAt(jsonFilePath)) &&
    (await isModifiedWithin24Hours(jsonFilePath));
  if (!currentYUIBuildExists) {
    await runYuidocCommand();
  } else {
    console.log("YUI output already exists, skipping build...");
  }
  return loadDocsFromJson();
}
async function runYuidocCommand() {
  console.log("Running yuidoc command...");
  try {
    await new Promise((resolve, reject) => {
      exec("yuidoc -p", (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running yuidoc command: ${error}`);
          reject();
        } else {
          console.log("yuidoc command completed successfully.");
          resolve();
        }
      });
    });
  } catch (err) {
    console.error(`Error running yuidoc command: ${err}`);
  }
}

/** MDX CONSTRUCTION */

function getModulePath(doc) {
  if (!doc || !doc.name) {
    return;
  }

  let prefix = `./src/pages/en/reference`;

  let docClass = doc.class;
  if (!docClass) {
    if (doc.module.startsWith("p5.")) {
      docClass = doc.module;
    } else {
      docClass = "p5";
    }
  }
  const path = `${prefix}/${docClass}/`;

  return path;
}

function addDocToModulePathTree(doc, path) {
  const modulePath = path.replace("./src/pages/en/reference/", "") + doc.name;
  if (doc.class && doc.class !== "p5") {
    if (!modulePathTree.classes[doc.class]) {
      modulePathTree.classes[doc.class] = {};
    }
    modulePathTree.classes[doc.class][doc.name] = modulePath;
  } else {
    if (!modulePathTree.modules[doc.module]) {
      modulePathTree.modules[doc.module] = {};
    }
    if (doc.submodule) {
      if (!modulePathTree.modules[doc.module][doc.submodule]) {
        modulePathTree.modules[doc.module][doc.submodule] = {};
      }
      modulePathTree.modules[doc.module][doc.submodule][doc.name] = modulePath;
    } else {
      modulePathTree.modules[doc.module][doc.name] = modulePath;
    }
  }
}

async function convertClassToMDX(doc) {
  let frontMatterArgs = {};
  const sourcePath = doc.file?.replace(/.*p5\.js\/(.*)/, "$1") ?? "";
  const memberMethodPreviews = classMethodPreviews[doc.name]
    ? { memberMethodPreviews: classMethodPreviews[doc.name] }
    : {};
  try {
    frontMatterArgs = {
      layout: "@layouts/reference/ClassReferenceLayout.astro",
      title: doc.name ?? "",
      module: doc.module,
      submodule: doc.submodule ?? "",
      file: sourcePath ?? "",
      description: doc.description ?? "",
      isConstructor: true,
      ...(doc.line ? { line: doc.line } : {}),
      ...(doc.params ? { params: doc.params } : {}),
      ...(doc.itemtype ? { itemtype: doc.itemtype } : {}),
      ...(doc.examples ? { examples: doc.examples } : {}),
      ...(doc.alt ? { alt: doc.alt } : {}),
      ...(doc.return ? { return: doc.return } : {}),
      ...memberMethodPreviews,
    };

    const frontmatter = matter.stringify("", frontMatterArgs);
    let markdownContent = `# ${doc.name}\n`;
    const mdxContent = remark().use(remarkMDX).processSync(markdownContent);
    return `${frontmatter}\n${mdxContent.toString()}`;
  } catch (err) {
    console.error(`Error converting ${doc.name} to MDX: ${err}`);
    console.log(frontMatterArgs);
    return;
  }
}

async function convertToMDX(doc) {
  if (!doc || !doc.name) {
    return;
  }

  if (doc.is_constructor) {
    return convertClassToMDX(doc);
  }

  if (doc.name?.startsWith("_")) {
    return;
  }

  if (doc.name.startsWith(">") || doc.name.startsWith("<")) {
    doc.name = doc.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let frontMatterArgs = {};
  const sourcePath = doc.file?.replace(/.*p5\.js\/(.*)/, "$1") ?? "";
  try {
    frontMatterArgs = {
      layout: "@layouts/reference/SingleReferenceLayout.astro",
      title: doc.name ?? "",
      module: doc.module,
      submodule: doc.submodule ?? "",
      file: sourcePath ?? "",
      description: doc.description ?? "",
      ...(doc.line ? { line: doc.line } : {}),
      ...(doc.params ? { params: doc.params } : {}),
      ...(doc.itemtype ? { itemtype: doc.itemtype } : {}),
      ...(doc.class ? { class: doc.class } : {}),
      ...(doc.examples ? { examples: doc.examples } : {}),
      ...(doc.alt ? { alt: doc.alt } : {}),
      ...(doc.return ? { return: doc.return } : {}),
      chainable: doc.chainable === 1,
    };

    const frontmatter = matter.stringify("", frontMatterArgs);
    let markdownContent = `# ${doc.name}\n`;
    const mdxContent = remark().use(remarkMDX).processSync(markdownContent);
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
  for (const key of Object.keys(modulePathTree.modules)) {
    markdownContent += `## ${key}\n`;
    const submodules = modulePathTree.modules[key];
    const scanAndAddSubmodules = (modules) => {
      if (!modules) return;
      for (const [key, val] of Object.entries(modules)) {
        if (typeof val === "object" && Object.keys(val).length > 0) {
          markdownContent += `### ${key}\n`;

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

async function classItemsToMDX(docs) {
  console.log("Converting YUI classitem docs to MDX...");

  return convertDocsToMDX(Object.values(docs.classitems));
}

async function classesToMDX(docs) {
  console.log("Converting YUI classes docs to MDX...");

  return convertDocsToMDX(Object.values(docs.classes));
}

function addClassMethodPreviewsToClassDocs(doc, path) {
  if (
    !doc.class ||
    doc.class === "p5" ||
    !doc.name ||
    !path ||
    !doc.description
  ) {
    return;
  }
  // If this is a class method, we need to add relevant info to the classMethodPreviews object
  if (!classMethodPreviews[doc.class]) {
    classMethodPreviews[doc.class] = {};
  }
  const classMethodPath = "../" + modulePathTree.classes[doc.class][doc.name];
  classMethodPreviews[doc.class][doc.name] = {
    description: doc.description,
    path: classMethodPath,
  };
}

async function convertDocsToMDX(docs) {
  try {
    const mdxDocs = await Promise.all(
      docs.map(async (doc) => {
        const mdx = await convertToMDX(doc);
        const savePath = getModulePath(doc);
        const name = doc.name;
        addDocToModulePathTree(doc, savePath);
        addClassMethodPreviewsToClassDocs(doc, savePath);
        return { mdx, savePath, name };
      })
    );

    return mdxDocs.filter(
      (mdxDoc) => mdxDoc.mdx && mdxDoc.savePath && mdxDoc.name
    );
  } catch (err) {
    console.error(`Error converting docs to MDX: ${err}`);
    return [];
  }
}

/** UTILITIES */

async function fileExistsAt(path) {
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false);
}

async function isModifiedWithin24Hours(path) {
  try {
    const stats = await fs.stat(path);
    const modifiedTime = stats.mtime.getTime();
    const currentTime = Date.now();
    const twentyFourHoursAgo = currentTime - 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    return modifiedTime >= twentyFourHoursAgo;
  } catch (err) {
    console.error(`Error checking modification time: ${err}`);
    return false;
  }
}
