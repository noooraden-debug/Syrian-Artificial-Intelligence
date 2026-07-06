type AttachmentMeta = { name: string; type: string; size: number } | null;

export async function generateSimulatedAssistantReply(prompt: string, isPro: boolean) {
  // محرك محاكاة ذكي ومتقدم
  const text = prompt.trim().toLowerCase();

  // محاكاة "التفكير"
  await new Promise(resolve => setTimeout(resolve, 1500));

  let response = "🤖 المساعد الذكي:\n\n";

  if (text.includes("كيف حالك")) {
    response += "بخير، شكراً لسؤالك! أنا أعمل بكامل طاقتي لمعالجة طلباتك. كيف يمكنني مساعدتك اليوم؟";
  } else if (text.includes("برمجة") || text.includes("كود") || text.includes("html")) {
    response += "لحل هذه المشكلة البرمجية، أنصحك باتباع الخطوات التالية:\n1. تحليل الخطأ بدقة.\n2. البحث عن الحلول في التوثيق الرسمي.\n3. تجربة كود بسيط لاختبار الحل.\n\nهل تحتاج إلى نموذج كود معين؟";
  } else if (text.includes("سوريا")) {
    response += "سوريا بلد عريق، وأنا هنا لأساعدك في أي معلومة أو مساعدة تحتاجها داخل حدود تطبيقنا، مع ضمان خصوصية بياناتك.";
  } else if (text.length < 5) {
    response += "يبدو أن سؤالك مختصر جداً، هل يمكنك تزويدي بمزيد من التفاصيل لأقدم لك إجابة أكثر دقة؟";
  } else {
    // إجابة عامة ولكنها منظمة كإجابة ذكاء اصطناعي
    response += `بناءً على طلبك: «${prompt.slice(0, 30)}...»\n\nهذا هو تحليلي:\n- الخطوة الأولى: فهم السياق العام للسؤال.\n- الخطوة الثانية: البحث عن المعطيات.\n- الخطوة الثالثة: صياغة إجابة منطقية ومفيدة.\n\nهل ترغب في توسيع هذه الإجابة أو الحصول على تفاصيل أكثر؟`;
  }

  return response;
}
