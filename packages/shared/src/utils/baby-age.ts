export function formatBabyAge(birthday: string, atDate: string): string {
  const birth = new Date(birthday);
  const at = new Date(atDate);

  if (birth > at) return '';

  const diffMs = at.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '';

  if (diffDays <= 30) {
    return diffDays === 0 ? '0天' : `${diffDays}天`;
  }

  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();

  const atYear = at.getFullYear();
  const atMonth = at.getMonth();
  const atDay = at.getDate();

  let years = atYear - birthYear;
  let months = atMonth - birthMonth;

  if (atDay < birthDay) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 2) {
    const totalMonths = years * 12 + months;
    return `${totalMonths}个月`;
  }

  if (months === 0) {
    return `${years}岁`;
  }

  return `${years}岁${months}个月`;
}

export function formatBabyAgeEn(birthday: string, atDate: string): string {
  const birth = new Date(birthday);
  const at = new Date(atDate);

  if (birth > at) return '';

  const diffMs = at.getTime() - birth.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return '';

  if (diffDays <= 30) {
    return diffDays === 0 ? '0 days' : diffDays === 1 ? '1 day' : `${diffDays} days`;
  }

  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();

  const atYear = at.getFullYear();
  const atMonth = at.getMonth();
  const atDay = at.getDate();

  let years = atYear - birthYear;
  let months = atMonth - birthMonth;

  if (atDay < birthDay) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 2) {
    const totalMonths = years * 12 + months;
    return totalMonths === 1 ? '1 month' : `${totalMonths} months`;
  }

  if (months === 0) {
    return years === 1 ? '1 year' : `${years} years`;
  }

  const yearStr = years === 1 ? '1 year' : `${years} years`;
  const monthStr = months === 1 ? '1 month' : `${months} months`;
  return `${yearStr} ${monthStr}`;
}
