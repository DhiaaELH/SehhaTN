import { Component, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OutcomeCardComponent } from './outcome-card.component';
import { Outcome, QuickReply, TriageService } from './triage.service';

type ChatMessage = { from: 'bot' | 'user'; text: string; kind?: 'urgent' | 'care' | 'normal'; outcome?: Outcome };

/** Assistant santé conversationnel : l'utilisateur décrit ses symptômes, le serveur pose les questions utiles
 *  puis donne une orientation (conseils, consultation, urgences). */
@Component({
  selector: 'app-triage-chat',
  standalone: true,
  imports: [FormsModule, OutcomeCardComponent],
  template: `
    <div class="triage-chat" [class.rtl-chat]="lang()==='ar'">
      <div class="chat-safety"><span>ⓘ</span><p>{{ tr('Cet assistant donne une orientation générale, pas un diagnostic. En cas de difficulté à respirer, douleur thoracique intense, perte de connaissance ou saignement important, appelez immédiatement le SAMU au 190.','يقدم هذا المساعد توجيهاً عاماً وليس تشخيصاً. عند صعوبة التنفس أو ألم شديد بالصدر أو فقدان الوعي أو نزيف حاد، اتصل بالإسعاف فوراً على 190.') }} <a href="tel:190">190</a></p></div>
      <div class="chat-transcript" #transcript role="log" aria-live="polite" [attr.aria-label]="tr('Conversation avec l’assistant santé','محادثة مع المساعد الصحي')">
        @for (m of messages(); track $index) {
          @if (m.outcome) {
            <div class="chat-outcome"><app-outcome-card [outcome]="m.outcome" [compact]="true" /></div>
          } @else {
            <div class="chat-message" [class.bot-message]="m.from==='bot'" [class.user-message]="m.from==='user'" [class.urgent-message]="m.kind==='urgent'" [class.care-message]="m.kind==='care'">
              <span class="chat-avatar">{{ m.from==='bot' ? '✚' : '●' }}</span><p>{{ m.text }}</p>
            </div>
          }
        }
        @if (busy()) { <div class="chat-message bot-message typing"><span class="chat-avatar">✚</span><p><i></i><i></i><i></i></p></div> }
      </div>
      @if (quickReplies().length && !busy()) {
        <div class="chat-quick" role="group" [attr.aria-label]="tr('Réponses rapides','ردود سريعة')">
          @for (q of quickReplies(); track q.label) { <button (click)="pick(q)">{{ q.label }}</button> }
        </div>
      }
      <div class="chat-composer"><textarea [(ngModel)]="draft" (keydown.enter)="$event.preventDefault();send()" [placeholder]="tr('Décrivez ce que vous ressentez… (ex. « mal au ventre depuis hier »)','صف ما تشعر به… (مثلاً «ألم في البطن منذ البارحة»)')" rows="2" maxlength="1000" [attr.aria-label]="tr('Décrire ses symptômes','وصف الأعراض')"></textarea><button class="primary-btn" (click)="send()" [disabled]="!draft.trim() || busy()">{{ tr('Envoyer','إرسال') }} <span>➤</span></button></div>
      <div class="chat-suggestions"><span>{{ tr('Exemples :','أمثلة:') }}</span>
        <button (click)="quick(tr('J’ai mal à la tête depuis ce matin','عندي صداع منذ الصباح'))">{{ tr('Mal de tête','صداع') }}</button>
        <button (click)="quick(tr('Mon fils de 4 ans a de la fièvre depuis hier','ابني عمره 4 سنوات عنده حمى منذ البارحة'))">{{ tr('Fièvre d’un enfant','حمى عند طفل') }}</button>
        <button (click)="quick(tr('J’ai mal au dos depuis deux semaines','عندي ألم في الظهر منذ أسبوعين'))">{{ tr('Mal de dos','ألم الظهر') }}</button>
        <button (click)="reset()">↺ {{ tr('Nouvelle conversation','محادثة جديدة') }}</button></div>
    </div>
  `,
  styles: [`
    .chat-quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 0 4px; }
    .chat-quick button { border: 1.5px solid var(--teal); background:var(--surface); color: var(--text2); border-radius: 999px; padding: 7px 14px; font-weight: 700; font-size: 13px; }
    .chat-quick button:hover { background: var(--teal); color: #fff; }
    .chat-outcome { margin: 6px 0 10px; }
    .typing p { display: flex; gap: 4px; align-items: center; min-height: 20px; }
    .typing i { width: 6px; height: 6px; border-radius: 50%; background: #8aa0b5; animation: blink 1s infinite; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes blink { 50% { opacity: .25; } }
    @media (prefers-reduced-motion: reduce) { .typing i { animation: none; } }
  `],
})
export class TriageChatComponent {
  private triage = inject(TriageService);
  readonly lang = input<'fr' | 'ar'>('fr');
  readonly governorate = input('');
  private transcript = viewChild<ElementRef<HTMLDivElement>>('transcript');

  draft = '';
  readonly busy = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly quickReplies = signal<QuickReply[]>([]);
  private state: Record<string, unknown> | undefined;

  constructor() {
    effect(() => { this.lang(); untracked(() => this.reset()); });
  }

  tr(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  quick(value: string) { this.draft = value; this.send(); }

  reset() {
    this.state = undefined;
    this.messages.set([]);
    this.quickReplies.set([]);
    this.turn({});
  }

  send() {
    const text = this.draft.trim();
    if (!text || this.busy()) return;
    this.draft = '';
    this.push({ from: 'user', text });
    this.turn({ message: text });
  }

  pick(q: QuickReply) {
    if (this.busy()) return;
    this.push({ from: 'user', text: q.label });
    this.turn({ answer: q.answer });
  }

  private push(m: ChatMessage) { this.messages.update((list) => [...list, m]); if (!m.outcome) this.scrollDown(); }

  private async turn(body: { message?: string; answer?: QuickReply['answer'] }) {
    this.busy.set(true);
    this.quickReplies.set([]);
    let gotOutcome = false;
    try {
      const r = await this.triage.chat({ ...body, state: this.state, lang: this.lang(), governorate: this.governorate() || undefined });
      this.state = r.state;
      for (const m of r.messages) this.push({ from: 'bot', text: m.text, kind: m.kind });
      if (r.outcome) {
        this.push({ from: 'bot', text: '', outcome: r.outcome });
        this.push({ from: 'bot', text: this.tr('Vous pouvez décrire un autre symptôme ou recommencer une nouvelle conversation.', 'يمكنك وصف عرض آخر أو بدء محادثة جديدة.') });
      }
      this.quickReplies.set(r.quick_replies);
      if (r.outcome) gotOutcome = true;
    } catch {
      this.push({ from: 'bot', kind: 'care', text: this.tr('Je ne parviens pas à joindre le serveur pour le moment. Réessayez dans un instant. Si la situation est urgente, appelez le 190.', 'تعذر الاتصال بالخادم حالياً. حاول بعد لحظات. إذا كانت الحالة طارئة، اتصل بالرقم 190.') });
    } finally {
      this.busy.set(false);
      if (gotOutcome) this.scrollToOutcome(); else this.scrollDown();
    }
  }

  /** Le résultat doit être lu depuis son titre (niveau de soins, bouton 190), pas depuis la fin. */
  private scrollToOutcome() {
    setTimeout(() => {
      const box = this.transcript()?.nativeElement;
      const cards = box?.querySelectorAll<HTMLElement>('.chat-outcome');
      const card = cards?.[cards.length - 1];
      if (!box || !card) return;
      box.scrollTop += card.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
    }, 60);
  }

  private scrollDown() {
    setTimeout(() => { const el = this.transcript()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }, 30);
  }
}
