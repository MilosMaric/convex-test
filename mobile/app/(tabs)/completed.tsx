import { useState } from 'react';
import TaskList, { SortType, DurationFilterType } from '@/components/TaskList';

export default function CompletedTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>('all');
  return <TaskList filter="completed" sort={sort} onSortChange={setSort} durationFilter={durationFilter} onDurationFilterChange={setDurationFilter} />;
}

