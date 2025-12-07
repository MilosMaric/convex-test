import { useState } from 'react';
import TaskList, { SortType, DurationFilterType } from '@/components/TaskList';

export default function ImportantTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  const [durationFilter, setDurationFilter] = useState<DurationFilterType>('all');
  return <TaskList filter="important" sort={sort} onSortChange={setSort} durationFilter={durationFilter} onDurationFilterChange={setDurationFilter} />;
}

