import { useState } from 'react';
import TaskList, { SortType } from '@/components/TaskList';

export default function AllTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  return <TaskList filter="all" sort={sort} onSortChange={setSort} />;
}
