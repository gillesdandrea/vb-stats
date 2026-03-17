# Comment la FFVB compose les poules de Coupe de France jeunes : 833 poules analysées, le verdict est sans appel

_Par un parent data scientist qui en avait marre de spéculer dans le mini-bus._

---

Chaque coach a sa théorie sur la composition des poules.

Vous connaissez la scène. Dimanche soir, le tirage tombe. Le groupe WhatsApp des parents s'enflamme. "Encore à l'autre bout de la France !" "C'est bizarre, on retombe toujours contre les mêmes..." "Les grosses équipes sont protégées, c'est évident." Et mon préféré : "Quelqu'un connaît quelqu'un à la fédé, c'est sûr."

Pendant cinq ans, j'ai écouté ces théories. Pendant cinq ans, j'ai chargé le mini-bus à 5h du matin pour emmener des gamins de 15 ans à 400 kilomètres. Pendant cinq ans, j'ai regardé les poules tomber en me demandant : _mais comment ils font, exactement ?_

Alors j'ai fait ce que fait un data scientist quand il n'a plus de patience : j'ai ouvert un tableur.

Puis deux. Puis dix. Et au final, j'ai analysé **cinq saisons complètes** de Coupe de France jeunes. Ce que j'ai trouvé va probablement vous surprendre.

## Le grand débat des poules

Si vous fréquentez les gymnases le week-end, vous avez forcément entendu l'une de ces théories :

**"C'est au mérite pur."** Les meilleures équipes sont séparées, les plus faibles regroupées. Un serpentin classique, comme à la télé pour la Coupe du Monde. Simple, logique, transparent.

**"C'est du serpentin géographique."** La fédé essaie de limiter les déplacements. Normal, on parle de gamins, pas de pros payés pour voyager.

**"Les grosses équipes sont protégées."** Certains clubs auraient des poules plus faciles. Un coup de pouce discret. Un arrangement entre amis.

**"C'est aléatoire, de toute façon."** Aucune logique, autant tirer au sort.

Le problème, c'est que personne ne sait vraiment. La FFVB ne publie pas d'algorithme. Pas de document officiel expliquant la méthode. Juste des poules qui tombent, et des parents qui râlent.

J'ai décidé d'arrêter de râler et de compter.

## L'enquête : cinq ans de données passés au crible

Voici ce que j'ai fait, concrètement.

J'ai récupéré l'intégralité des résultats de la Coupe de France jeunes sur cinq saisons, de 2022 à 2026. Six catégories : M15F, M15M, M18F, M18M, M21F, M21M. Je me suis concentré sur les journées au mérite -- à partir de la journée 5, là où la composition des poules n'est plus géographique par définition mais supposément basée sur le classement.

Ça représente :

- **88 journées** au mérite
- **833 poules**
- **2 499 paires d'équipes** à analyser

Ensuite, j'ai géocodé **607 clubs** sur tout le territoire français. Chaque club a reçu ses coordonnées GPS, ce qui m'a permis de calculer la distance réelle entre chaque paire d'équipes dans chaque poule.

Et puis j'ai fait tourner des **simulations Monte Carlo**. Le principe est simple : pour chaque journée, je génère des milliers de compositions de poules aléatoires qui respectent les mêmes contraintes. Ça me donne une référence : _à quoi ressembleraient les poules si elles étaient tirées au hasard ?_ Et je compare avec la réalité.

C'est comme mesurer la température d'un patient : il faut d'abord savoir ce qu'est "normal" pour dire si c'est chaud ou froid.

## La révélation : c'est la géographie, pas le classement

Le résultat est limpide. Pas ambigu. Pas "ça dépend". Limpide.

Les poules réelles sont en moyenne **27% plus proches géographiquement** que des poules aléatoires.

Le ratio de distance est de **0.734**. Si les poules étaient purement aléatoires, ce ratio serait de 1.0. S'il était de 0.5, les équipes joueraient quasiment chez elles. À 0.734, la géographie pèse clairement dans la balance.

Et le classement ? La corrélation entre le rang des équipes et la composition des poules est **quasi-nulle**. Autrement dit, que vous soyez premier ou dernier du classement, ça ne change fondamentalement rien à la poule dans laquelle vous atterrissez.

Relisez cette phrase. Elle devrait mettre fin à 80% des débats de parking.

**Les grosses équipes ne sont pas protégées.** Il n'y a pas de main invisible qui sépare les favoris ou regroupe les faibles. Le système ne regarde pas votre classement pour décider de votre poule. Il regarde votre _code postal_.

## Les contraintes : un sans-faute

J'ai aussi vérifié les contraintes "dures" -- celles que la fédé est censée respecter systématiquement :

- **Pas de re-match** : deux équipes qui se sont déjà affrontées dans la compétition ne doivent pas se retrouver dans la même poule.
- **Pas de trois premiers** : une poule ne peut pas contenir trois équipes classées premières de leur poule précédente.

Sur 833 poules et 2 499 paires d'équipes : **zéro violation**. Pas une seule. Cinq saisons, six catégories, zéro écart.

Et la sélection du club qui accueille la journée ? J'ai vérifié aussi. Elle est **neutre par rapport au classement**. Le club hôte n'est ni systématiquement le mieux classé, ni le moins bien classé. Pas de favoritisme.

Le système est strict, rigoureux, et appliqué sans exception. On peut lui reprocher beaucoup de choses, mais certainement pas d'être laxiste.

## Le déclin géographique : quand il n'y a plus assez d'équipes proches

Voici un phénomène que j'ai trouvé fascinant -- et que tout parent ayant survécu aux phases finales comprendra instinctivement.

À la **journée 5**, quand il reste encore beaucoup d'équipes en lice, la distance moyenne entre équipes d'une même poule est d'environ **186 kilomètres**. C'est raisonnable. Un aller-retour dans la journée, c'est faisable. Le mini-bus rentre avant le dîner.

À la **journée 8**, quand il ne reste qu'une poignée d'équipes, cette distance explose à **plus de 500 kilomètres**. Et là, c'est le départ à 4h du matin, le sandwich triangle sur l'autoroute, et les gamins qui dorment dans le bus au retour.

C'est mathématique, pas politique. Quand il reste 8 équipes réparties sur tout le territoire, il n'y a physiquement plus moyen de faire des poules de proximité. Vous pouvez avoir le meilleur algorithme du monde : si les quatre dernières équipes sont à Lille, Marseille, Brest et Strasbourg, personne ne joue à côté de chez soi.

Ce déclin géographique est progressif, prévisible, et inévitable. Ce n'est pas la fédé qui vous punit. C'est la géométrie du territoire français.

## "Un proche, un loin" : la règle cachée des poules

Il y a un schéma que personne ne voit à l'œil nu, mais que les données révèlent clairement : dans chaque poule de trois, un visiteur est proche et l'autre est loin. Systématiquement.

En moyenne, le visiteur le plus proche parcourt **202 kilomètres** (médiane 182 km), et le plus éloigné **398 kilomètres** (médiane 376 km). Le ratio est presque de 2 pour 1 -- le visiteur loin parcourt environ le double du visiteur proche.

Les chiffres sont frappants : **87% des visiteurs "proches"** font moins de 300 km. En revanche, **près de 28% des visiteurs "loin"** dépassent les 500 km.

Dans votre poule, il y a presque toujours une équipe qui fait 2h de route -- et une qui fait 4h.

Ça veut dire quelque chose d'important : la FFVB ne cherche pas à rapprocher tout le monde. Elle garantit un déplacement court pour une équipe, et accepte un déplacement long pour l'autre. C'est un compromis malin : si on essayait de rapprocher les deux visiteurs à parts égales, aucun des deux ne serait vraiment proche. Mieux vaut un trajet court et un trajet long que deux trajets moyennement longs.

## Ce que ça veut dire pour vous

Alors, qu'est-ce qu'on retient de tout ça ?

**Le système est équitable.** Pas parfait -- équitable. La FFVB utilise la géographie comme critère principal pour limiter les déplacements des jeunes. Elle respecte scrupuleusement les contraintes d'intégrité sportive. Et elle ne manipule pas les classements.

**Les troisièmes sont éliminés, pas "placés".** J'ai souvent entendu que les équipes classées troisièmes de leur poule étaient placées dans des poules faciles pour leur donner une chance. Les données disent non. Les troisièmes sont traités exactement comme les autres.

**C'est de la logistique, pas de la politique.** La prochaine fois que vous verrez votre poule et que vous aurez envie de crier au complot, rappelez-vous : l'algorithme essaie surtout de vous éviter 800 kilomètres de route. Parfois il y arrive. Parfois la géographie française ne le permet pas.

**"Pourquoi c'est toujours nous qui voyageons loin ?"** Parce que dans chaque poule, il y a un proche et un loin. Si vous êtes le "loin" cette journée-là, c'est que l'algorithme a privilégié la proximité pour l'autre visiteur. À la journée suivante, les rôles peuvent s'inverser. Ce n'est pas du favoritisme -- c'est un compromis géographique qui garantit au moins un trajet court dans chaque poule.

**Votre frustration est légitime, mais mal dirigée.** Si vous trouvez que vous voyagez trop aux phases finales, c'est vrai -- mais c'est parce qu'il reste peu d'équipes, pas parce que quelqu'un a décidé de vous envoyer loin. La solution serait structurelle (plus de sites neutres, phases régionales plus longues), pas conspirationniste.

## Prédire les poules : l'outil

Après avoir compris comment le système fonctionne, j'ai fait un pas de plus : j'ai construit un **outil de prédiction des poules**.

Si la géographie est le facteur dominant, alors on peut simuler les poules probables avant qu'elles ne tombent. L'outil prend en compte les résultats de la journée précédente, les contraintes de non-répétition, et optimise la proximité géographique selon le schéma "un proche, un loin" -- exactement comme semble le faire la fédération.

Ce n'est pas de la voyance. C'est de la rétro-ingénierie basée sur cinq ans de données et 833 poules analysées. Et les résultats sont encourageants : l'outil retrouve fréquemment des compositions très proches de la réalité.

Vous pouvez explorer toutes les données, les visualisations, et l'outil de prédiction sur **[vb-stats](https://gillesdandrea.github.io/vb-stats)**.

## Le mot de la fin

J'ai commencé cette enquête frustré, convaincu que j'allais trouver des irrégularités. J'imaginais déjà le post vengeur sur les réseaux. "La preuve que le système est truqué !"

Les données m'ont donné tort. Et honnêtement, c'est la meilleure nouvelle possible.

Ça veut dire que quand votre équipe se retrouve dans une poule difficile, ce n'est pas un complot -- c'est le jeu. Ça veut dire que quand vous voyagez loin en phase finale, ce n'est pas une punition -- c'est la conséquence mécanique d'être encore en course dans une compétition nationale. Ça veut dire que le système, malgré son opacité, fait honnêtement son travail.

Est-ce qu'il pourrait être plus transparent ? Absolument. Publier l'algorithme, même dans les grandes lignes, éteindrait 90% des polémiques. Est-ce qu'il pourrait mieux optimiser les distances aux phases finales ? Peut-être, avec des sites neutres ou des regroupements. Mais est-ce qu'il est truqué ?

Non.

833 poules. 2 499 paires. 5 saisons. La réponse est non.

---

_Toutes les données et visualisations sont disponibles en open source sur [vb-stats](https://gillesdandrea.github.io/vb-stats). Si vous êtes coach, parent, ou simplement curieux, allez jeter un oeil. Et la prochaine fois que le tirage tombe, respirez un coup avant d'ouvrir WhatsApp._
