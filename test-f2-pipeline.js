/**
 * F2 Planning Pipeline Test Script
 * Run with: node test-f2-pipeline.js
 *
 * Tests the 3-stage planning pipeline with mock file data.
 * Requires GEMINI_API_KEY in .env file.
 */

require('dotenv').config();

const { getPlanningEngine } = require('./dist/main/main/services/planning-engine');

async function testPipeline() {
  console.log('=== F2 Planning Pipeline Test ===\n');

  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }
  console.log('API key found.\n');

  // Mock input simulating F1 handoff
  const mockInput = {
    conversationId: 'test-conv-001',
    userIntent: 'Organize my Downloads folder by file type',
    targetFolder: 'C:\\Users\\backtrack-testing\\Downloads',
    constraints: [],
    scannedFiles: [
      { name: 'report.pdf', path: 'C:\\Users\\backtrack-testing\\Downloads\\report.pdf', size: 1024000, extension: '.pdf', modified: '2025-01-15T10:00:00Z', created: '2025-01-10T08:00:00Z', isDirectory: false },
      { name: 'vacation.jpg', path: 'C:\\Users\\backtrack-testing\\Downloads\\vacation.jpg', size: 3500000, extension: '.jpg', modified: '2025-01-14T12:00:00Z', created: '2025-01-14T12:00:00Z', isDirectory: false },
      { name: 'notes.txt', path: 'C:\\Users\\backtrack-testing\\Downloads\\notes.txt', size: 2048, extension: '.txt', modified: '2025-01-16T09:00:00Z', created: '2025-01-16T09:00:00Z', isDirectory: false },
      { name: 'presentation.pptx', path: 'C:\\Users\\backtrack-testing\\Downloads\\presentation.pptx', size: 5000000, extension: '.pptx', modified: '2025-01-13T15:00:00Z', created: '2025-01-12T10:00:00Z', isDirectory: false },
      { name: 'budget.xlsx', path: 'C:\\Users\\backtrack-testing\\Downloads\\budget.xlsx', size: 150000, extension: '.xlsx', modified: '2025-01-15T14:00:00Z', created: '2025-01-15T14:00:00Z', isDirectory: false },
      { name: 'song.mp3', path: 'C:\\Users\\backtrack-testing\\Downloads\\song.mp3', size: 8000000, extension: '.mp3', modified: '2025-01-12T20:00:00Z', created: '2025-01-12T20:00:00Z', isDirectory: false },
      { name: 'installer.exe', path: 'C:\\Users\\backtrack-testing\\Downloads\\installer.exe', size: 25000000, extension: '.exe', modified: '2025-01-11T11:00:00Z', created: '2025-01-11T11:00:00Z', isDirectory: false },
      { name: 'photo_001.png', path: 'C:\\Users\\backtrack-testing\\Downloads\\photo_001.png', size: 2000000, extension: '.png', modified: '2025-01-16T08:00:00Z', created: '2025-01-16T08:00:00Z', isDirectory: false },
    ],
    parsedIntent: {
      target: 'Downloads',
      action: 'organize',
      method: 'by file type',
      constraints: [],
      clarityScore: 0.9,
      needsClarification: false,
    }
  };

  console.log(`Input: "${mockInput.userIntent}"`);
  console.log(`Target: ${mockInput.targetFolder}`);
  console.log(`Files: ${mockInput.scannedFiles.length}\n`);

  try {
    const engine = getPlanningEngine();

    console.log('Starting 3-stage pipeline...\n');
    const startTime = Date.now();

    const result = await engine.generateCompletePlan(mockInput);

    const totalTime = Date.now() - startTime;

    console.log('\n=== RESULTS ===\n');
    console.log(`Plan ID: ${result.plan_id}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Total Actions: ${result.actions.length}`);
    console.log(`Files Affected: ${result.summary.files_affected}`);
    console.log(`Folders Created: ${result.summary.folders_created}`);

    console.log('\n--- Actions ---');
    result.actions.forEach((action, i) => {
      console.log(`  ${i + 1}. [${action.type}] ${action.description}`);
      if (action.params.source) console.log(`     From: ${action.params.source}`);
      if (action.params.destination) console.log(`     To:   ${action.params.destination}`);
      if (action.params.path) console.log(`     Path: ${action.params.path}`);
    });

    console.log('\n--- Safety Analysis ---');
    console.log(`  Risk Level: ${result.safety_analysis.overall_risk}`);
    console.log(`  Is Safe: ${result.safety_analysis.is_safe}`);
    if (result.safety_analysis.issues.length > 0) {
      result.safety_analysis.issues.forEach(issue => {
        console.log(`  Issue: [${issue.severity}] ${issue.description}`);
      });
    } else {
      console.log('  No issues found.');
    }

    console.log('\n--- Undo Plan ---');
    console.log(`  Undo ID: ${result.undo_plan.undo_plan_id}`);
    console.log(`  Deterministic: ${result.undo_plan.deterministic}`);
    console.log(`  Undo Actions: ${result.undo_plan.undo_actions.length}`);
    result.undo_plan.undo_actions.forEach((action, i) => {
      console.log(`  ${i + 1}. [${action.type}] ${action.description}`);
    });

    console.log('\n--- Gemini Metadata ---');
    const meta = result.gemini_metadata;
    console.log(`  Stage 1: ${meta.stage1_latency_ms}ms, ${meta.stage1_tokens} tokens (${meta.stage1_thinking_level})`);
    console.log(`  Stage 2: ${meta.stage2_latency_ms}ms, ${meta.stage2_tokens} tokens (${meta.stage2_thinking_level})`);
    console.log(`  Stage 3: ${meta.stage3_latency_ms}ms, ${meta.stage3_tokens} tokens (${meta.stage3_thinking_level})`);
    console.log(`  Total: ${meta.total_time_ms}ms, ${meta.total_tokens} tokens`);

    // Save full JSON output
    const fs = require('fs');
    const outputPath = './test-f2-output.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\nFull JSON output saved to: ${outputPath}`);

    console.log('\n=== TEST PASSED ===');

  } catch (error) {
    console.error('\n=== TEST FAILED ===');
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

testPipeline();
