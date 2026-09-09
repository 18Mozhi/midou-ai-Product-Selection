function canConfirm(input) {
  if (input.destructive && !input.acknowledged) return false;
  const required = input.confirmationText?.trim();
  return !required || input.typedText?.trim() === required;
}
window.CAPACITY_CONFIRM = canConfirm;
