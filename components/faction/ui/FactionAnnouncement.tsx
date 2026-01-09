
import React from 'react';
import { Megaphone } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';

interface FactionAnnouncementProps {
  announcement: { title: string; message: string } | null;
  onClose: () => void;
}

export const FactionAnnouncement: React.FC<FactionAnnouncementProps> = ({ announcement, onClose }) => {
  if (!announcement) return null;

  return (
    <Modal
      isOpen={true}
      title="📣 시스템 공지"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={<Button variant="primary" onClick={onClose}>확인</Button>}
    >
      <div className="flex flex-col items-center text-center p-2">
        <div className="bg-orange-900/30 p-4 rounded-full mb-4 border border-orange-500/50">
          <Megaphone size={40} className="text-orange-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{announcement.title}</h3>
        <p className="text-gray-300 whitespace-pre-wrap">{announcement.message}</p>
      </div>
    </Modal>
  );
};
