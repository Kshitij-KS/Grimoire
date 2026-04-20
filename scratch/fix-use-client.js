const fs = require('fs');
const files = [
  'components/auth/auth-shell.tsx',
  'components/bible/entity-create-modal.tsx',
  'components/bible/entity-merge-modal.tsx',
  'components/bible/forge-relationship-modal.tsx',
  'components/dashboard/account-settings-panel.tsx',
  'components/layout/world-settings-drawer.tsx',
  'components/lore/loom-editor.tsx',
  'components/lore/lore-import-modal.tsx',
  'components/lore/lore-search-panel.tsx',
  'components/lore/processing-status.tsx',
  'components/narrator/narrator-tools.tsx',
  'components/shared/destructive-action-modal.tsx',
  'components/tapestry/tapestry-timeline.tsx',
  'components/tavern/tavern-chat.tsx',
  'components/worlds/world-collaborators-tab.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('"use client"') && !content.startsWith('"use client"')) {
    // Remove it from wherever it is
    content = content.replace(/"use client";?\r?\n/g, '');
    // Add it to the top
    content = '"use client";\n' + content;
    fs.writeFileSync(f, content, 'utf8');
    console.log(`Fixed use client in ${f}`);
  }
});
