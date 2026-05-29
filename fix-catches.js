const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/components/OnboardingWizard.tsx',
  'apps/web/src/app/(superadmin)/superadmin/login/page.tsx',
  'apps/web/src/app/(superadmin)/superadmin/resellers/page.tsx',
  'apps/web/src/app/(superadmin)/superadmin/demos/page.tsx',
  'apps/web/src/app/(superadmin)/superadmin/plans/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/deliveries/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/ai-training/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/campaigns/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/reservations/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/contacts/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/groups/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/quotes/page.tsx',
  'apps/web/src/app/(dashboard)/dashboard/departments/page.tsx',
];

for (const rel of files) {
  const filePath = path.join(__dirname, rel);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found):', rel);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  // Only process if it has a silent catch
  if (!content.includes('catch { /* ignore */') && !content.includes('catch { /* ignore,') && !content.includes("catch { setError('Error de conexión')")) {
    console.log('SKIP (no silent catch):', rel);
    continue;
  }

  // Add toast import if missing
  if (!content.includes('useToast')) {
    // Find a good place to insert: after the last import line
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, "import { toast } from '@/hooks/useToast';");
      content = lines.join('\n');
    }
  }

  // Replace silent catches
  content = content.replace(
    /catch\s*\{\s*\/\* ignore \*\/\s*\}/g,
    "catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); }"
  );
  content = content.replace(
    /catch\s*\{\s*\/\* ignore,[^*]*\*\/\s*\}/g,
    "catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); }"
  );
  content = content.replace(
    /catch\s*\{\s*setError\('Error de conexión'\);\s*\}/g,
    "catch (err) { toast.error(err instanceof Error ? err.message : 'Error de conexión'); setError('Error de conexión'); }"
  );

  fs.writeFileSync(filePath, content);
  console.log('FIXED:', rel);
}
