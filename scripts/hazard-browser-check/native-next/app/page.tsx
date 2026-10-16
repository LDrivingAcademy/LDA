import {TheoryTestSuite} from '../../../../src/components/theory-test-suite';
export default async function Page({searchParams}:{searchParams:Promise<{mode?:string}>}) {
  const {mode}=await searchParams;
  return <TheoryTestSuite hazardVideoEnabled={mode!=='legacy'} />;
}
