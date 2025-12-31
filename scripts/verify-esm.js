
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const API_DIR = path.join(ROOT_DIR, 'api');

let hasError = false;

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Regex to match imports/exports
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
    const requireRegex = /bold\(['"]([^'"]+)['"]\)/g; // Just kidding, actual require
    const realRequireRegex = /require\(['"]([^'"]+)['"]\)/g;

    lines.forEach((line, index) => {
        let match;
        const checkPath = (importPath) => {
            // Ignore packages (node_modules) - starts with letter or @
            if (!importPath.startsWith('.')) return;

            // 1. Check for missing extension
            const ext = path.extname(importPath);
            if (!ext) {
                console.error(`❌ [Missing Extension] ${path.relative(ROOT_DIR, filePath)}:${index + 1} -> '${importPath}'`);
                hasError = true;
            }

            // 2. Check for directory import (naive check: if it ends in 'db' or 'utils' etc and has no ext)
            // Actually, simply enforcing extension covers 99% of directory import cases because directories don't have extensions.
            // But we can specifically check if it resolves to a directory.

            try {
                const dir = path.dirname(filePath);
                const resolved = path.resolve(dir, importPath);
                if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
                    console.error(`❌ [Directory Import] ${path.relative(ROOT_DIR, filePath)}:${index + 1} -> '${importPath}' (Must point to index.js)`);
                    hasError = true;
                }
            } catch (e) {
                // Ignore resolution errors here, just checking syntax
            }
        };

        while ((match = importRegex.exec(line)) !== null) {
            checkPath(match[1]);
        }
        while ((match = dynamicImportRegex.exec(line)) !== null) {
            checkPath(match[1]);
        }
        while ((match = realRequireRegex.exec(line)) !== null) {
            // Require can technically omit extension in CJS, but we want uniformity if possible. 
            // However, for strict ESM in Vercel, we focus on imports.
            // Let's inspect requires too if they are local.
            checkPath(match[1]);
        }
    });
}

console.log("🔍 Verifying ESM imports in src/ and api/...");

const srcFiles = getAllFiles(SRC_DIR);
const apiFiles = getAllFiles(API_DIR);

[...srcFiles, ...apiFiles].forEach(file => {
    // Skip test files if needed, but integration tests usually act like code
    checkFile(file);
});

if (hasError) {
    console.error("\n💥 ESM verification failed! Please fix the imports above.");
    process.exit(1);
} else {
    console.log("✅ ESM verification passed!");
    process.exit(0);
}
