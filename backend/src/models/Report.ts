import { query } from '../config/db.js';
import { ReportReason, ReportStatus, ReportTargetType } from '@returnit/shared';

export interface IReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Report = {
  /** Files a report once per reporter and target. Returns false if it was already reported. */
  async create(data: { reporterId: string; targetType: ReportTargetType; targetId: string; reason: string; details: string }): Promise<boolean> {
    const res = await query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING`,
      [data.reporterId, data.targetType, data.targetId, data.reason, data.details],
    );
    return (res.rowCount ?? 0) > 0;
  },
};
