interface Props {
  displayName: string
  onCancel: () => void
  onBlock: () => void
  // Omitted when there's no profile to report (e.g. a sender who never saved one)
  onBlockAndReport?: () => void
}

export default function BlockConfirm({ displayName, onCancel, onBlock, onBlockAndReport }: Props) {
  return (
    <div className="border-2 border-ink p-4 space-y-3 bg-accent-100">
      <p className="text-[14px] text-accent-700 font-extrabold">Block {displayName}?</p>
      <p className="text-[12px] text-neutral-700">
        They won't be able to message you, send contact requests, see your profile or see contact details
        you've shared. They won't be told. You can unblock them from your profile settings.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-200">Cancel</button>
        <button type="button" onClick={onBlock} className="flex-1 h-10 bg-accent hover:bg-accent-600 text-white font-bold text-[13px]">Block</button>
      </div>
      {onBlockAndReport && (
        <button type="button" onClick={onBlockAndReport} className="text-[12px] font-bold text-accent-700 hover:underline">
          Block and report to the admin
        </button>
      )}
    </div>
  )
}
