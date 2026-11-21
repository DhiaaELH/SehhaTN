import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ChatMessage = { from: 'bot' | 'user'; text: string; kind?: 'urgent' | 'care' | 'normal' };

@Component({
  selector: 'app-triage-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="triage-chat" [class.rtl-chat]="lang==='ar'" aria-live="polite">
      <div class="chat-safety"><span>ⓘ</span><p>{{ tr('Cet assistant donne des informations générales, pas un diagnostic. En cas de difficulté à respirer, douleur thoracique intense, perte de connaissance ou saignement important, appelez immédiatement le SAMU au 190.','يقدم هذا المساعد معلومات عامة وليس تشخيصاً. عند صعوبة التنفس أو ألم شديد بالصدر أو فقدان الوعي أو نزيف حاد، اتصل بالإسعاف فوراً على 190.') }} <a href="tel:190">190</a></p></div>
      <div class="chat-transcript" #transcript role="log" aria-label="Conversation avec l’assistant santé">
        <div *ngFor="let message of messages" class="chat-message" [class.bot-message]="message.from==='bot'" [class.user-message]="message.from==='user'" [class.urgent-message]="message.kind==='urgent'" [class.care-message]="message.kind==='care'"><span class="chat-avatar">{{ message.from==='bot' ? '✚' : '●' }}</span><p>{{ message.text }}</p></div>
      </div>
      <div class="chat-composer"><textarea [(ngModel)]="draft" (keydown.enter)="$event.preventDefault();send()" [placeholder]="tr('Décrivez ce que vous ressentez…','صف ما تشعر به…')" rows="2" aria-label="Décrire ses symptômes"></textarea><button class="primary-btn" (click)="send()" [disabled]="!draft.trim() || busy">{{ tr('Envoyer','إرسال') }} <span>➤</span></button></div>
      <div class="chat-suggestions"><span>{{ tr('Exemples :','أمثلة:') }}</span><button (click)="quick('J’ai mal à la tête depuis ce matin')">{{ tr('Mal de tête','صداع') }}</button><button (click)="quick('J’ai de la fièvre depuis hier')">{{ tr('Fièvre','حمى') }}</button><button (click)="quick('J’ai du mal à respirer')">{{ tr('Difficulté à respirer','صعوبة التنفس') }}</button><button (click)="reset()">{{ tr('Nouvelle conversation','محادثة جديدة') }}</button></div>
    </div>
  `,
})
export class TriageChatComponent {
  @Input() lang: 'fr' | 'ar' = 'fr';
  @ViewChild('transcript') transcript?: ElementRef<HTMLDivElement>;
  draft = '';
  busy = false;
  turn = 0;
  private symptom = '';
  private redFlag = false;
  messages: ChatMessage[] = [];

  ngOnInit() { this.reset(); }
  tr(fr: string, ar: string) { return this.lang === 'fr' ? fr : ar; }
  quick(value: string) { this.draft = value; this.send(); }
  reset() {
    this.turn = 0; this.symptom = ''; this.redFlag = false;
    this.messages = [{ from: 'bot', text: this.tr('Bonjour, je suis l’assistant d’orientation SehhaTN. Quel est le principal symptôme qui vous gêne ? Depuis quand ?','مرحباً، أنا مساعد التوجيه الصحي في SehhaTN. ما العرض الأساسي الذي يزعجك؟ ومتى بدأ؟') }];
  }
  send() {
    const text = this.draft.trim(); if (!text || this.busy) return;
    this.draft = ''; this.messages.push({ from: 'user', text }); this.busy = true;
    window.setTimeout(() => { this.respond(text); this.busy = false; this.scrollDown(); }, 180);
  }
  private respond(text: string) {
    const s = text.toLocaleLowerCase();
    const urgentTerms = ['du mal à respirer','difficulté à respirer','respire plus','essoufflement important','douleur thoracique','mal à la poitrine','douleur insupportable','douleur très forte','perte de connaissance','évanoui','paralys','saignement important','hémorrag','confusion soudaine'];
    const urgentAr = ['صعوبة التنفس','لا أستطيع التنفس','ألم في الصدر','ألم شديد جداً','فقدان الوعي','نزيف شديد','شلل مفاجئ'];
    if (urgentTerms.some(x => s.includes(x)) || urgentAr.some(x => text.includes(x))) {
      this.redFlag = true;
      this.messages.push({ from: 'bot', kind: 'urgent', text: this.tr('Cela peut nécessiter une aide immédiate. Appelez le SAMU au 190 maintenant ou demandez à quelqu’un près de vous de le faire. Ne conduisez pas vous-même.','قد تحتاج هذه الحالة إلى مساعدة فورية. اتصل بالإسعاف على 190 الآن أو اطلب من شخص قريب الاتصال. لا تقد السيارة بنفسك.') });
      return;
    }
    if (this.turn === 0) {
      this.symptom = text; this.turn++;
      this.messages.push({ from: 'bot', text: this.tr('Merci. Pour mieux vous orienter : quel âge a la personne concernée, et avez-vous aussi de la fièvre, une douleur très forte, un malaise ou un autre symptôme inquiétant ?','شكراً. لمساعدتك في التوجيه: كم عمر الشخص المعني؟ وهل توجد حمى أو ألم شديد أو دوخة أو عرض آخر مقلق؟') }); return;
    }
    if (this.turn === 1) {
      this.turn++;
      if (/très fort|insupportable|s'aggrave|s aggrave|enceinte|grossesse|nourrisson|bébé|enfant de moins|plus de 65|65 ans|forte fièvre|39|40|malaise|vomissements répétés|دم|شديد|حامل|رضيع/.test(s) || /شديد|حامل|رضيع|إغماء|حمى مرتفعة/.test(text)) {
        this.messages.push({ from: 'bot', kind: 'care', text: this.tr('Compte tenu de ce que vous décrivez, contactez un professionnel de santé aujourd’hui pour un avis adapté. Si la situation s’aggrave ou devient urgente, appelez le 190.','بناءً على ما تصفه، تواصل مع مختص صحي اليوم للحصول على نصيحة مناسبة. إذا ساءت الحالة أو أصبحت طارئة، اتصل بـ190.') });
      } else {
        this.messages.push({ from: 'bot', text: this.tr('Je ne peux pas déterminer la cause de « '+this.symptom+' ». Depuis quand cela a-t-il commencé, et est-ce que cela s’améliore, reste pareil ou s’aggrave ?','لا أستطيع تحديد سبب «'+this.symptom+'». متى بدأ ذلك؟ وهل يتحسن أم يبقى كما هو أم يزداد سوءاً؟') });
      }
      return;
    }
    this.messages.push({ from: 'bot', kind: 'care', text: this.tr('Surveillez l’évolution, reposez-vous et hydratez-vous si vous le pouvez. Comme le symptôme persiste ou vous préoccupe, prenez conseil auprès d’un médecin ou pharmacien. Cette conversation ne permet pas d’établir un diagnostic.','راقب تطور الأعراض، واسترح واشرب الماء إن أمكن. بما أن العرض مستمر أو يقلقك، استشر طبيباً أو صيدلياً. لا يمكن لهذه المحادثة تقديم تشخيص.') });
    this.turn++;
  }
  private scrollDown() { if (this.transcript) this.transcript.nativeElement.scrollTop = this.transcript.nativeElement.scrollHeight; }
}
