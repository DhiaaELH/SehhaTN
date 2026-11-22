p='app.ts'
raw=open(p,encoding='utf-8',newline='').read()
nl='\r\n' if '\r\n' in raw else '\n'
L=raw.split(nl)
a=[i for i,l in enumerate(L) if '<section class="hero"' in l]
b=[i for i,l in enumerate(L) if 'class="home-quote"' in l]
assert len(a)==1 and len(b)==1 and a[0]<b[0], "ancres introuvables (hero / home-quote) : envoie-moi le resultat de : findstr /n \"hero home-quote router-outlet\" app.ts"
assert not any('router-outlet' in l for l in L[a[0]:b[0]+1]), 'router-outlet dans la zone : arrete'
L[a[0]:b[0]+1]=['      <app-home *ngIf="view===\'home\'" (search)="homeSearch($event)"></app-home>']
s=nl.join(L)
def rep(old,new):
    global s
    assert old in s, 'introuvable: '+old
    s=s.replace(old,new,1)
if 'HomeComponent' not in s:
    rep("import { LangService } from './lang.service';","import { LangService } from './lang.service';"+nl+"import { HomeComponent } from './home.component';"+nl+"import type { HomeSearch } from './home.component';")
    rep("AccountComponent, RouterOutlet]","AccountComponent, RouterOutlet, HomeComponent]")
    rep("  quickSearch(q: string) {","  homeSearch(f: HomeSearch) { this.specialtyFilter=f.specialty??''; this.cityFilter=f.governorate??''; this.searchText=f.name??''; this.go('doctors'); }"+nl+"  quickSearch(q: string) {")
open(p,'w',encoding='utf-8',newline='').write(s)
print('OK')
