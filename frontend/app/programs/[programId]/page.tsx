import { ProgramDetailPage } from "@/features/programs/program-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;

  return <ProgramDetailPage programId={Number(programId)} />;
}

