import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { readPersistence, removePersistence, writePersistence } from "../lib/persistence";

const stateStorage: StateStorage = {
  getItem: (name) => readPersistence<string | null>(name, null),
  setItem: (name, value) => writePersistence(name, value),
  removeItem: (name) => removePersistence(name),
};

export const zustandPersistStorage = createJSONStorage(() => stateStorage);
