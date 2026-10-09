using UnityEngine;

namespace WitchWorkshop.Dialogue
{
    /// <summary>
    /// Base class for scene components that provide GLOBAL (persistent) dialogue variables.
    /// To connect an existing save system, derive from this class and forward <see cref="TryGet"/> / <see cref="Set"/>
    /// to your save data (see Documentation~/SaveIntegration.md), then assign the component to the DialogueManager.
    /// </summary>
    public abstract class VariableStoreBase : MonoBehaviour, IVariableStore
    {
        public abstract bool TryGet(string name, out DialogueValue value);
        public abstract void Set(string name, DialogueValue value);
    }
}
