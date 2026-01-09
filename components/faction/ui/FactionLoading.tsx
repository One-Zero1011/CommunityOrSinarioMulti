
import React from 'react';

export const FactionLoading: React.FC = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      <p>호스트로부터 진영 데이터를 받아오는 중...</p>
    </div>
  );
};
