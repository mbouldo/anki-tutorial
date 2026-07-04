## Creating Cloze Deletion Cards

Cloze deletion cards hide portions of text and ask you to recall the missing information. They are one of the most commonly used card types because they are fast to create and work well for facts, lists, and concepts, and scale better than a simple front + back card.

To create a cloze card, select the text you want to hide and click the **Cloze** button, or manually wrap the text with cloze syntax.

Examples:

`The capital of France is {{c1::Paris}}` 

= *The capital of France is _____* 

`{{c1::Paris}} is the capital of {{c2::France}}` 

= *_____ is the capital of France* && *Paris is the capital of _____* (two cards, with two different blanks)

`The {{c1::heart}} pumps {{c1::blood}} throughout the body` 

= *The _____ pumps _____ throughout the body* (two blanks at card)

In the first example, one card is created. In the second example, two separate cards are created because `c1` and `c2` are different cloze numbers. In the third example, both deletions appear on the same card because they share the same cloze number (`c1`).

- Most commonly used Anki note type
- `c1`, `c2`, `c3`, etc. create separate cards
- Multiple `c1` deletions are hidden together on the same card
- Best for facts, lists, and definitions

