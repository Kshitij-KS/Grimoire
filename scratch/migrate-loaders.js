const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./components', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('Loader2')) {
    let newContent = content;

    // Replace component usage
    newContent = newContent.replace(/<Loader2([\s\S]*?)\/?>/g, (match, p1) => {
      // If we had className="... animate-spin ...", we might want to remove animate-spin if our custom spinner handles it.
      // But if we just replace it, our spinner ignores animate-spin anyway or applies it (which might look doubly spinny?).
      // The spinner has its own internal spinning, so animate-spin on className container might make it spin twice as fast.
      let newProps = p1.replace(/ animate-spin/g, '').replace(/animate-spin /g, '');
      return `<LoadingSpinner${newProps}/>`;
    });

    // Remove Loader2 from lucide-react import
    newContent = newContent.replace(/Loader2,\s*/g, '');
    newContent = newContent.replace(/,\s*Loader2/g, '');
    // If Loader2 was the only import: import { Loader2 }
    newContent = newContent.replace(/import\s*{\s*Loader2\s*}\s*from\s*["']lucide-react["'];?\n/g, '');

    // Add LoadingSpinner import right after the lucide-react import or at the top
    if (!newContent.includes('LoadingSpinner')) {
      newContent = "import { LoadingSpinner } from \"@/components/shared/loading-spinner\";\n" + newContent;
    } else if (newContent.includes('<LoadingSpinner') && !newContent.includes('import { LoadingSpinner }')) {
      // Find a safe place to inject import
       const reactImportMatch = newContent.match(/import .*?from ["']react["'];?/);
       if (reactImportMatch) {
         newContent = newContent.replace(reactImportMatch[0], reactImportMatch[0] + '\nimport { LoadingSpinner } from "@/components/shared/loading-spinner";');
       } else {
         newContent = "import { LoadingSpinner } from \"@/components/shared/loading-spinner\";\n" + newContent;
       }
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
