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
      {/* Reporting gets a full button, not a link: it's what someone being harassed most needs to see */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onBlock} className="h-10 bg-accent hover:bg-accent-600 text-white font-bold text-[13px]">Block</button>
        {onBlockAndReport ? (
          <button type="button" onClick={onBlockAndReport} className="h-10 bg-ink hover:bg-neutral-800 text-white font-bold text-[13px]">Block and report</button>
        ) : (
          <button type="button" onClick={onCancel} className="h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-200">Cancel</button>
        )}
      </div>
      {onBlockAndReport && (
        <button type="button" onClick={onCancel} className="w-full h-10 border-2 border-ink text-[13px] font-bold text-ink hover:bg-accent-200">Cancel</button>
      )}
    </div>
  )
}
