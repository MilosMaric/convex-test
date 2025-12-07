import { useState } from 'react';
import TaskList, { SortType, DurationFilterType } from '@/components/TaskList';

export default function IncompleteTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>('all');
  return <TaskList filter="incomplete" sort={sort} onSortChange={setSort} durationFilter={durationFilter} onDurationFilterChange={setDurationFilter} />;
}

