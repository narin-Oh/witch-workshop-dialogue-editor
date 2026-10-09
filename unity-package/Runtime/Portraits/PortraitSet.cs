using System;
using System.Collections.Generic;
using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// All artwork for one character: a default sprite plus one sprite per expression.
    /// Create via Assets &gt; Create &gt; Witch Workshop &gt; Dialogue &gt; Portrait Set and assign your own (pixel-art) sprites.
    /// </summary>
    [CreateAssetMenu(fileName = "NewPortraitSet", menuName = "Witch Workshop/Dialogue/Portrait Set")]
    public class PortraitSet : ScriptableObject
    {
        [Serializable]
        public struct ExpressionSprite
        {
            [Tooltip("The expression name exactly as typed in the editor's Dialogue node, e.g. happy, worried, neutral.")]
            public string expression;
            public Sprite sprite;
        }

        [Tooltip("The portrait ID exactly as typed in the editor's Dialogue node, e.g. mira.")]
        [SerializeField] private string portraitId;

        [Tooltip("Used when a line asks for an expression this set does not have (and there is no 'neutral').")]
        [SerializeField] private Sprite defaultSprite;

        [SerializeField] private List<ExpressionSprite> expressions = new List<ExpressionSprite>();

        public string PortraitId { get { return portraitId; } set { portraitId = value; } }
        public Sprite DefaultSprite { get { return defaultSprite; } set { defaultSprite = value; } }
        public IList<ExpressionSprite> Expressions { get { return expressions; } }

        public void AddExpression(string expression, Sprite sprite) { expressions.Add(new ExpressionSprite { expression = expression, sprite = sprite }); }
    }
}
