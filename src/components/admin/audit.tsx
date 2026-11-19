'use client';
import { useAdminWorkspace, Empty } from './admin-context';
export default function AuditPage() {
    const { data, filteredActivities, auditPage, pagination, activityRow } = useAdminWorkspace();
    return <><section className="panel activity-panel"><div className="panel-heading"><h2>Activity history</h2><span className="activity-count">{data.pageMeta?.total ?? filteredActivities.length} records</span></div>{auditPage.items.map(activityRow)}{!filteredActivities.length && <Empty/>}{pagination(auditPage, 'Activity pages')}</section></>;
}
