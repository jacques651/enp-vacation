// src/components/dashboard/KpiCard.tsx
import { Card, Text } from '@mantine/core';

export default function KpiCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Text size="sm" c="dimmed">
        {title}
      </Text>

      <Text size="xl" fw={700}>
        {value}
      </Text>
    </Card>
  );
}