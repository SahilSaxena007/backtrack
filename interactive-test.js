/**
 * Interactive F2 Planning Test
 * Run with: node interactive-test.js
 *
 * Type your instruction and see the generated plan.
 */

require('dotenv').config();
const readline = require('readline');
const { getPlanningEngine } = require('./dist/main/main/services/planning-engine');
const fs = require('fs');
const path = require('path');

// Test folder with sample files
const TEST_FOLDER = 'C:\\Users\\backtrack-testing\\Downloads';

// Sample file database (simulating scanned files)
const SAMPLE_FILES = {
  'Downloads': [
    { name: 'report.pdf', path: `${TEST_FOLDER}\\report.pdf`, size: 1024000, extension: '.pdf', modified: '2025-01-15T10:00:00Z', created: '2025-01-10T08:00:00Z', isDirectory: false },
    { name: 'vacation.jpg', path: `${TEST_FOLDER}\\vacation.jpg`, size: 3500000, extension: '.jpg', modified: '2025-01-14T12:00:00Z', created: '2025-01-14T12:00:00Z', isDirectory: false },
    { name: 'notes.txt', path: `${TEST_FOLDER}\\notes.txt`, size: 2048, extension: '.txt', modified: '2025-01-16T09:00:00Z', created: '2025-01-16T09:00:00Z', isDirectory: false },
    { name: 'presentation.pptx', path: `${TEST_FOLDER}\\presentation.pptx`, size: 5000000, extension: '.pptx', modified: '2025-01-13T15:00:00Z', created: '2025-01-12T10:00:00Z', isDirectory: false },
    { name: 'budget.xlsx', path: `${TEST_FOLDER}\\budget.xlsx`, size: 150000, extension: '.xlsx', modified: '2025-01-15T14:00:00Z', created: '2025-01-15T14:00:00Z', isDirectory: false },
    { name: 'song.mp3', path: `${TEST_FOLDER}\\song.mp3`, size: 8000000, extension: '.mp3', modified: '2025-01-12T20:00:00Z', created: '2025-01-12T20:00:00Z', isDirectory: false },
    { name: 'installer.exe', path: `${TEST_FOLDER}\\installer.exe`, size: 25000000, extension: '.exe', modified: '2025-01-11T11:00:00Z', created: '2025-01-11T11:00:00Z', isDirectory: false },
    { name: 'photo_001.png', path: `${TEST_FOLDER}\\photo_001.png`, size: 2000000, extension: '.png', modified: '2025-01-16T08:00:00Z', created: '2025-01-16T08:00:00Z', isDirectory: false },
    { name: 'tax_2024.pdf', path: `${TEST_FOLDER}\\tax_2024.pdf`, size: 512000, extension: '.pdf', modified: '2024-12-15T10:00:00Z', created: '2024-12-15T10:00:00Z', isDirectory: false },
    { name: 'receipt_01.jpg', path: `${TEST_FOLDER}\\receipt_01.jpg`, size: 850000, extension: '.jpg', modified: '2025-01-10T14:00:00Z', created: '2025-01-10T14:00:00Z', isDirectory: false },
    { name: 'meeting_notes.docx', path: `${TEST_FOLDER}\\meeting_notes.docx`, size: 45000, extension: '.docx', modified: '2025-01-14T09:30:00Z', created: '2025-01-14T09:30:00Z', isDirectory: false },
    { name: 'video.mp4', path: `${TEST_FOLDER}\\video.mp4`, size: 125000000, extension: '.mp4', modified: '2025-01-13T20:00:00Z', created: '2025-01-13T20:00:00Z', isDirectory: false },
  ],
  'Desktop': [
    { name: 'project.zip', path: 'C:\\Users\\backtrack-testing\\Desktop\\project.zip', size: 15000000, extension: '.zip', modified: '2025-01-15T11:00:00Z', created: '2025-01-15T11:00:00Z', isDirectory: false },
    { name: 'draft.txt', path: 'C:\\Users\\backtrack-testing\\Desktop\\draft.txt', size: 3000, extension: '.txt', modified: '2025-01-16T10:00:00Z', created: '2025-01-16T10:00:00Z', isDirectory: false },
    { name: 'screenshot.png', path: 'C:\\Users\\backtrack-testing\\Desktop\\screenshot.png', size: 1200000, extension: '.png', modified: '2025-01-14T16:00:00Z', created: '2025-01-14T16:00:00Z', isDirectory: false },
  ],
  'Documents': [
    { name: 'resume.pdf', path: 'C:\\Users\\backtrack-testing\\Documents\\resume.pdf', size: 250000, extension: '.pdf', modified: '2025-01-10T09:00:00Z', created: '2025-01-10T09:00:00Z', isDirectory: false },
    { name: 'cover_letter.docx', path: 'C:\\Users\\backtrack-testing\\Documents\\cover_letter.docx', size: 35000, extension: '.docx', modified: '2025-01-11T10:00:00Z', created: '2025-01-11T10:00:00Z', isDirectory: false },
  ]
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function printBanner() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║      Backtrack F2 Planning Engine - Interactive Test          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('Available folders to test:');
  console.log('  • Downloads (12 files: PDFs, images, docs, audio, video, exe)');
  console.log('  • Desktop (3 files: zip, txt, screenshot)');
  console.log('  • Documents (2 files: resume, cover letter)\n');
  console.log('Example commands:');
  console.log('  • "organize Downloads by file type"');
  console.log('  • "sort Desktop by date"');
  console.log('  • "organize Documents by name"\n');
  console.log('Type your instruction (or "exit" to quit):\n');
}

function detectFolder(instruction) {
  const lower = instruction.toLowerCase();
  if (lower.includes('download')) return 'Downloads';
  if (lower.includes('desktop')) return 'Desktop';
  if (lower.includes('document')) return 'Documents';
  return 'Downloads'; // default
}

async function generatePlan(instruction) {
  const folder = detectFolder(instruction);
  const files = SAMPLE_FILES[folder];
  const targetPath = folder === 'Downloads' ? TEST_FOLDER :
                     folder === 'Desktop' ? 'C:\\Users\\backtrack-testing\\Desktop' :
                     'C:\\Users\\backtrack-testing\\Documents';

  console.log(`\n📁 Target: ${folder} (${files.length} files)`);
  console.log(`📝 Instruction: "${instruction}"\n`);
  console.log('⏳ Generating plan... (this takes ~20-30 seconds)\n');

  const input = {
    conversationId: 'interactive-test-' + Date.now(),
    userIntent: instruction,
    targetFolder: targetPath,
    constraints: [],
    scannedFiles: files,
    parsedIntent: {
      target: folder,
      action: 'organize',
      method: 'by_type',
      constraints: [],
      clarityScore: 0.9,
      needsClarification: false
    }
  };

  try {
    const engine = getPlanningEngine();
    const startTime = Date.now();
    const result = await engine.generateCompletePlan(input);
    const duration = Date.now() - startTime;

    // Print results
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        PLAN GENERATED                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`✓ Plan ID: ${result.plan_id}`);
    console.log(`✓ Generated in: ${(duration / 1000).toFixed(1)}s`);
    console.log(`✓ Total Actions: ${result.actions.length}`);
    console.log(`✓ Files Affected: ${result.summary.files_affected}`);
    console.log(`✓ Folders Created: ${result.summary.folders_created}\n`);

    console.log('─── ACTIONS ───────────────────────────────────────────────────\n');
    result.actions.forEach((action, i) => {
      console.log(`${i + 1}. [${action.type.toUpperCase()}]`);
      console.log(`   ${action.description}`);
      if (action.params.path) console.log(`   📂 ${action.params.path}`);
      if (action.params.source && action.params.destination) {
        console.log(`   📤 From: ${path.basename(action.params.source)}`);
        console.log(`   📥 To:   ${path.basename(action.params.destination)}`);
      }
      if (action.params.files) {
        console.log(`   📄 Files: ${action.params.files.length} file(s)`);
      }
      console.log('');
    });

    console.log('─── SAFETY ANALYSIS ───────────────────────────────────────────\n');
    console.log(`   Risk Level: ${result.safety_analysis.overall_risk.toUpperCase()}`);
    console.log(`   Is Safe: ${result.safety_analysis.is_safe ? '✓ YES' : '✗ NO'}`);
    if (result.safety_analysis.issues.length > 0) {
      console.log(`   Issues Found: ${result.safety_analysis.issues.length}\n`);
      result.safety_analysis.issues.forEach(issue => {
        console.log(`   ⚠ [${issue.severity}] ${issue.description}`);
      });
    } else {
      console.log('   No issues detected.\n');
    }

    console.log('─── UNDO CAPABILITY ───────────────────────────────────────────\n');
    console.log(`   Undo Plan: ${result.undo_plan.undo_plan_id}`);
    console.log(`   Undo Actions: ${result.undo_plan.undo_actions.length}`);
    console.log(`   Checkpoint: ${result.undo_plan.checkpoint.checkpoint_id}\n`);

    console.log('─── PERFORMANCE ───────────────────────────────────────────────\n');
    console.log(`   Stage 1 (Draft):   ${result.gemini_metadata.stage1_latency_ms}ms`);
    console.log(`   Stage 2 (Safety):  ${result.gemini_metadata.stage2_latency_ms}ms`);
    console.log(`   Stage 3 (Undo):    ${result.gemini_metadata.stage3_latency_ms}ms`);
    console.log(`   Total:             ${result.gemini_metadata.total_time_ms}ms`);
    console.log(`   Tokens Used:       ${result.gemini_metadata.total_tokens}\n`);

    // Save to file
    const outputPath = `./plan-${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`💾 Full plan saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }

  printBanner();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!\n');
      process.exit(0);
    }

    await generatePlan(trimmed);

    console.log('\n' + '═'.repeat(64) + '\n');
    console.log('Type another instruction (or "exit" to quit):\n');
    rl.prompt();
  });

  rl.prompt();
}

main();
