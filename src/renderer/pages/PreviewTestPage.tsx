/**
 * F3 Preview Component Test Page
 *
 * This page lets you manually test and view the Preview Toast, Panel, and Button components.
 * Navigate to http://localhost:8000/#/preview-test to use it.
 */

import { useState } from 'react';
import { usePreviewStore, PreviewMode } from '../store/previewStore';
import { PreviewButton } from '../components/preview/PreviewButton';
import type { F2_to_F3_Input } from '@shared/types';

// Mock F2 output for testing
const MOCK_PLANS: Record<string, F2_to_F3_Input> = {
  safe: {
    plan_id: 'plan_test_001',
    actions: [
      {
        id: 'a1',
        type: 'create_folder',
        params: { path: 'C:\\Downloads\\Documents' },
        description: 'Create Documents folder',
        depends_on: [],
        estimated_time_ms: 100
      },
      {
        id: 'a2',
        type: 'create_folder',
        params: { path: 'C:\\Downloads\\Images' },
        description: 'Create Images folder',
        depends_on: [],
        estimated_time_ms: 100
      },
      {
        id: 'a3',
        type: 'move_files_batch',
        params: {
          source: 'C:\\Downloads',
          destination: 'C:\\Downloads\\Documents',
          files: ['report.pdf', 'notes.txt', 'presentation.pptx']
        },
        description: 'Move documents to Documents folder',
        depends_on: ['a1'],
        estimated_time_ms: 500
      },
      {
        id: 'a4',
        type: 'move_files_batch',
        params: {
          source: 'C:\\Downloads',
          destination: 'C:\\Downloads\\Images',
          files: ['vacation.jpg', 'photo.png']
        },
        description: 'Move images to Images folder',
        depends_on: ['a2'],
        estimated_time_ms: 300
      }
    ],
    undo_plan: {
      undo_plan_id: 'undo_001',
      original_plan_id: 'plan_test_001',
      undo_actions: [
        {
          id: 'u1',
          type: 'move_files_batch',
          params: {
            source: 'C:\\Downloads\\Documents',
            destination: 'C:\\Downloads',
            files: ['report.pdf', 'notes.txt', 'presentation.pptx']
          },
          description: '[UNDO] Move files back to Downloads',
          depends_on: [],
          estimated_time_ms: 300
        }
      ],
      checkpoint: {
        checkpoint_id: 'cp_001',
        plan_id: 'plan_test_001',
        timestamp: new Date().toISOString(),
        target_folder: 'C:\\Downloads',
        file_snapshot: [
          { path: 'C:\\Downloads\\report.pdf', size: 1024000, modified: '2025-01-15T10:00:00Z' },
          { path: 'C:\\Downloads\\vacation.jpg', size: 3500000, modified: '2025-01-14T12:00:00Z' }
        ]
      },
      deterministic: true
    },
    safety_analysis: {
      overall_risk: 'safe',
      is_safe: true,
      issues: [],
      checks: {
        data_loss_risk: { passed: true },
        permission_issues: { passed: true },
        file_conflicts: { passed: true },
        circular_dependencies: { passed: true },
        disk_space: { passed: true },
        protected_paths: { passed: true }
      }
    },
    summary: {
      total_actions: 4,
      files_affected: 5,
      folders_created: 2
    },
    gemini_metadata: {
      stage1_thinking_level: 'low',
      stage1_signature: 'sig_s1_abc123',
      stage1_latency_ms: 8000,
      stage1_tokens: 2500,
      stage2_thinking_level: 'high',
      stage2_signature: 'sig_s2_def456',
      stage2_latency_ms: 10000,
      stage2_tokens: 3000,
      stage3_thinking_level: 'high',
      stage3_signature: 'sig_s3_ghi789',
      stage3_latency_ms: 12000,
      stage3_tokens: 2500,
      total_time_ms: 30000,
      total_tokens: 8000
    }
  },
  risky: {
    plan_id: 'plan_test_002',
    actions: [
      {
        id: 'a1',
        type: 'create_folder',
        params: { path: 'C:\\Downloads\\Archive' },
        description: 'Create Archive folder',
        depends_on: [],
        estimated_time_ms: 100
      },
      {
        id: 'a2',
        type: 'move_files_batch',
        params: {
          source: 'C:\\Downloads',
          destination: 'C:\\Downloads\\Archive',
          files: ['important_project.zip', 'client_data.xlsx', 'backup.tar.gz']
        },
        description: 'Move archive files',
        depends_on: ['a1'],
        estimated_time_ms: 1000
      }
    ],
    undo_plan: {
      undo_plan_id: 'undo_002',
      original_plan_id: 'plan_test_002',
      undo_actions: [],
      checkpoint: {
        checkpoint_id: 'cp_002',
        plan_id: 'plan_test_002',
        timestamp: new Date().toISOString(),
        target_folder: 'C:\\Downloads',
        file_snapshot: []
      },
      deterministic: true
    },
    safety_analysis: {
      overall_risk: 'high',
      is_safe: false,
      issues: [
        {
          type: 'data_loss_risk',
          severity: 'high',
          description: 'Moving large archive files - ensure backup exists',
          affected_actions: ['a2']
        }
      ],
      checks: {
        data_loss_risk: { passed: false, issue: 'High-value files detected' },
        permission_issues: { passed: true },
        file_conflicts: { passed: true },
        circular_dependencies: { passed: true },
        disk_space: { passed: true },
        protected_paths: { passed: true }
      }
    },
    summary: {
      total_actions: 2,
      files_affected: 3,
      folders_created: 1
    },
    gemini_metadata: {
      stage1_thinking_level: 'low',
      stage1_signature: 'sig_s1_xyz111',
      stage1_latency_ms: 7000,
      stage1_tokens: 2200,
      stage2_thinking_level: 'high',
      stage2_signature: 'sig_s2_xyz222',
      stage2_latency_ms: 11000,
      stage2_tokens: 3200,
      stage3_thinking_level: 'high',
      stage3_signature: 'sig_s3_xyz333',
      stage3_latency_ms: 13000,
      stage3_tokens: 2800,
      total_time_ms: 31000,
      total_tokens: 8200
    }
  }
};

export function PreviewTestPage() {
  const { mode, plan, showToast, showPanel, showButton, cancelPlan } = usePreviewStore();
  const [selectedPlan, setSelectedPlan] = useState<'safe' | 'risky'>('safe');

  const handleShowToast = () => {
    const mockPlan = MOCK_PLANS[selectedPlan];
    showToast(mockPlan);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <PreviewButton />
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">F3 Preview Components Test</h1>
          <p className="text-slate-400">Test the Toast, Panel, and Button components in isolation</p>
        </div>

        {/* Control Panel */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl mb-8">
          <div className="space-y-4">
            {/* Plan Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Select Mock Plan
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPlan('safe')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    selectedPlan === 'safe'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  ✓ Safe Plan
                </button>
                <button
                  onClick={() => setSelectedPlan('risky')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                    selectedPlan === 'risky'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  ⚠ Risky Plan
                </button>
              </div>
            </div>

            {/* Mode Display */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Current Preview Mode
              </label>
              <div className="px-4 py-3 rounded-lg bg-slate-700/50 border border-white/10">
                <p className="text-sm text-slate-300">
                  <span className="font-mono text-emerald-400">{mode}</span>
                </p>
                {plan && (
                  <p className="text-xs text-slate-400 mt-1">
                    Plan: {plan.plan_id} ({plan.summary.total_actions} actions)
                  </p>
                )}
              </div>
            </div>

            {/* Test Buttons */}
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
                Test Actions
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShowToast}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition"
                >
                  Show Toast
                </button>
                <button
                  onClick={showPanel}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white font-semibold hover:bg-purple-600 transition disabled:opacity-50"
                  disabled={!plan}
                >
                  Show Panel
                </button>
                <button
                  onClick={showButton}
                  className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition disabled:opacity-50"
                  disabled={!plan}
                >
                  Show Button
                </button>
                <button
                  onClick={cancelPlan}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition"
                >
                  Hide All
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-400/30 p-3">
              <p className="text-xs text-blue-200">
                <strong>💡 Tip:</strong> Click "Show Toast" to trigger the 8-second auto-hide timer.
                The toast will automatically become a button after hiding.
              </p>
            </div>
          </div>
        </div>

        {/* Current Plan Details */}
        {plan && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white mb-4">Current Plan Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">Plan ID</p>
                <p className="text-sm font-mono text-slate-200">{plan.plan_id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Risk Level</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    plan.safety_analysis.overall_risk === 'safe'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : plan.safety_analysis.overall_risk === 'low'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : plan.safety_analysis.overall_risk === 'medium'
                          ? 'bg-amber-500/20 text-amber-200'
                          : plan.safety_analysis.overall_risk === 'high'
                            ? 'bg-orange-500/20 text-orange-200'
                            : 'bg-red-500/20 text-red-200'
                  }`}
                >
                  {plan.safety_analysis.overall_risk.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Actions</p>
                <p className="text-sm font-semibold text-slate-200">{plan.summary.total_actions}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Files Affected</p>
                <p className="text-sm font-semibold text-slate-200">{plan.summary.files_affected}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Folders Created</p>
                <p className="text-sm font-semibold text-slate-200">{plan.summary.folders_created}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Total Time</p>
                <p className="text-sm font-semibold text-slate-200">
                  {plan.gemini_metadata.total_time_ms}ms
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
