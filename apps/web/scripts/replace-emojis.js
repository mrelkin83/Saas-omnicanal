const fs = require('fs');
const path = require('path');

const EMOJI_MAP = {
  '💬': 'MessageSquare',
  '📦': 'Package',
  '⚙️': 'Settings',
  '📡': 'Radio',
  '🛒': 'ShoppingCart',
  '📅': 'CalendarDays',
  '📥': 'Inbox',
  '👥': 'Users',
  '🤖': 'Bot',
  '🧠': 'Brain',
  '🔌': 'Plug',
  '📋': 'ClipboardList',
  '🗓️': 'Calendar',
  '🛵': 'Bike',
  '🗂️': 'LayoutGrid',
  '🧑‍💼': 'UsersRound',
  '🏢': 'Building2',
  '📢': 'Megaphone',
  '💬': 'MessagesSquare',
  '➕': 'Plus',
  '✏️': 'Pencil',
  '🗑️': 'Trash2',
  '✅': 'CheckCircle',
  '❌': 'XCircle',
  '🔍': 'Search',
  '📊': 'BarChart3',
  '🖥️': 'Monitor',
  '👑': 'Crown',
  '🧪': 'FlaskConical',
  '🤝': 'Handshake',
  '💳': 'CreditCard',
  '🏠': 'Home',
  '🚪': 'LogOut',
  '⚡': 'Zap',
  '🚀': 'Rocket',
  '📱': 'Smartphone',
  '📸': 'Camera',
  '📘': 'BookOpen',
  '🎵': 'Music',
  '💰': 'TrendingUp',
  '⏳': 'Clock',
  '🔔': 'Bell',
  '⚠️': 'AlertTriangle',
  '🔄': 'RefreshCw',
  '📤': 'Upload',
  '🔗': 'Link',
  '👁️': 'Eye',
  '📄': 'FileText',
  '🏷️': 'Tag',
  '⭐': 'Star',
  '📍': 'MapPin',
  '📞': 'Phone',
  '📧': 'Mail',
  '📝': 'FileEdit',
  '🔒': 'Lock',
  '🔓': 'Unlock',
  '🌐': 'Globe',
  '📂': 'FolderOpen',
  '📁': 'Folder',
  '🎯': 'Target',
  '📈': 'TrendingUp',
  '📉': 'TrendingDown',
  '💵': 'Banknote',
  '🏪': 'Store',
  '🍔': 'UtensilsCrossed',
  '🎉': 'PartyPopper',
  '💡': 'Lightbulb',
  '📣': 'Volume2',
  '🔧': 'Wrench',
  '🔢': 'Hash',
  '🕐': 'Clock',
  '👤': 'User',
  '🔽': 'ChevronDown',
  '🔼': 'ChevronUp',
  '➡️': 'ArrowRight',
  '⬅️': 'ArrowLeft',
  '📶': 'Signal',
  '✉️': 'Mail',
  '🚫': 'Ban',
  '💎': 'Gem',
  '🏆': 'Trophy',
  '🎁': 'Gift',
  '🔥': 'Flame',
  '🌟': 'Sparkles',
  '💫': 'Sparkles',
  '🏁': 'Flag',
  '🎬': 'Clapperboard',
  '📽️': 'Video',
  '🎤': 'Mic',
  '🎧': 'Headphones',
  '🎮': 'Gamepad2',
  '🎲': 'Dices',
  '🎳': 'Bowling',
  '🥇': 'Medal',
  '🥈': 'Award',
  '🥉': 'BadgeCheck',
  '🏅': 'Award',
  '🎖️': 'Shield',
  '🏵️': 'Flower2',
  '🎗️': 'Ribbon',
  '🎫': 'Ticket',
  '🎟️': 'TicketCheck',
  '🎪': 'Tent',
  '🎭': 'Drama',
  '🎨': 'Palette',
  '🎰': 'Dices',
  '🎱': 'CircleDot',
  '📲': 'Smartphone',
  '👋': 'Hand',
  '💪': 'Dumbbell',
  '🙌': 'PartyPopper',
  '✨': 'Sparkles',
  '🎊': 'PartyPopper',
  '🎈': 'Circle',
  '☀️': 'Sun',
  '🌙': 'Moon',
  '☁️': 'Cloud',
  '🌧️': 'CloudRain',
  '❄️': 'Snowflake',
  '💧': 'Droplets',
  '🌊': 'Waves',
  '🌍': 'Globe',
  '🌎': 'Globe',
  '🌏': 'Globe',
  '💻': 'Laptop',
  '🖨️': 'Printer',
  '📠': 'Fax',
  '📟': 'Tablet',
  '📹': 'Video',
  '📷': 'Camera',
  '📼': 'Disc',
  '🔋': 'Battery',
  '💿': 'Disc',
  '📀': 'Disc',
  '🙏': 'HandHeart',
};

function findTsxFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTsxFiles(full, files);
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const files = findTsxFiles(path.join(__dirname, '../src/app'));
let totalFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  const imports = new Set();

  for (const [emoji, iconName] of Object.entries(EMOJI_MAP)) {
    const pattern = new RegExp('(>[\\s]*)' + emoji + '([\\s]*<)', 'g');
    content = content.replace(pattern, (m, before, after) => {
      changed = true;
      imports.add(iconName);
      return before + `<${iconName} className="w-4 h-4 inline-block" />` + after;
    });
  }

  if (changed) {
    const importLine = "import { " + Array.from(imports).join(', ') + " } from 'lucide-react';";
    const hasLucide = content.includes("from 'lucide-react'");
    if (!hasLucide) {
      const firstImport = content.indexOf("import ");
      if (firstImport >= 0) {
        content = content.slice(0, firstImport) + importLine + '\n' + content.slice(firstImport);
      } else {
        content = importLine + '\n' + content;
      }
    } else {
      const lucideMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
      if (lucideMatch) {
        const existing = lucideMatch[1].split(',').map(s => s.trim());
        const newImports = Array.from(imports).filter(i => !existing.includes(i));
        if (newImports.length > 0) {
          const combined = existing.join(', ') + ', ' + newImports.join(', ');
          content = content.replace(lucideMatch[0], `import { ${combined} } from 'lucide-react'`);
        }
      }
    }
    fs.writeFileSync(file, content);
    totalFiles++;
    console.log('Modified:', path.relative(process.cwd(), file));
  }
}

console.log('Total files modified:', totalFiles);
